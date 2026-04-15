"""Conversation router — persistent chat tied to journal entries."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Conversation, JournalEntry
from app.services.ai_service import get_ai_provider
from app.services.memory_service import get_memory_context, extract_memories, maybe_auto_compact
from app.services.sponsor_guidelines import get_system_prompt, get_step_context, get_template, get_all_templates

router = APIRouter()


class MessageIn(BaseModel):
    user_id: str = "default"
    conversation_id: str | None = None
    entry_id: str | None = None
    message: str
    template_key: str | None = None
    current_step: int | None = None


class ConversationOut(BaseModel):
    id: str
    user_id: str
    entry_id: str | None
    messages: list
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[ConversationOut])
async def list_conversations(
    user_id: str = "default",
    entry_id: str | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(Conversation.user_id == user_id)
    if entry_id:
        stmt = stmt.where(Conversation.entry_id == entry_id)
    stmt = stmt.order_by(desc(Conversation.updated_at)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


@router.post("/send")
async def send_message(data: MessageIn, db: AsyncSession = Depends(get_db)):
    """Send a message, get AI response, persist everything."""
    try:
        provider = get_ai_provider()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Get or create conversation
    convo = None
    if data.conversation_id:
        convo = await db.get(Conversation, data.conversation_id)

    if not convo:
        convo = Conversation(
            user_id=data.user_id,
            entry_id=data.entry_id,
            messages=[],
        )
        db.add(convo)
        await db.commit()
        await db.refresh(convo)

    # Build system prompt with full memory context
    memory_context = await get_memory_context(data.user_id, db)
    system = get_system_prompt()
    if memory_context:
        system += "\n\n" + memory_context
    if data.current_step:
        system += get_step_context(data.current_step)

    # Inject current journal entry content so AI can read it
    entry_id = data.entry_id or convo.entry_id
    if entry_id:
        entry = await db.get(JournalEntry, entry_id)
        if entry and entry.content:
            system += f"\n\nCURRENT JOURNAL ENTRY (what the person has written so far):\nTitle: {entry.title}\n{entry.content}"

    messages = [{"role": "system", "content": system}]

    # Add conversation history
    for msg in convo.messages:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # If a template was chosen on the first message, inject it
    if data.template_key and len(convo.messages) == 0:
        template = get_template(data.template_key)
        if template:
            messages.append({"role": "assistant", "content": template["prompt"]})

    messages.append({"role": "user", "content": data.message})

    # Get AI response
    try:
        response = await provider.chat(messages)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")

    # Update conversation with both messages
    now = datetime.now(timezone.utc).isoformat()
    new_messages = list(convo.messages)

    if data.template_key and len(convo.messages) == 0:
        template = get_template(data.template_key)
        if template:
            new_messages.append({"role": "assistant", "content": template["prompt"], "timestamp": now})

    new_messages.append({"role": "user", "content": data.message, "timestamp": now})
    new_messages.append({"role": "assistant", "content": response, "timestamp": now})

    convo.messages = new_messages
    convo.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(convo)

    # Extract memories in background (best-effort) + auto-compact
    try:
        text = f"User said: {data.message}\nAI responded: {response}"
        await extract_memories(text, data.user_id, "conversation", convo.id, db)
        await maybe_auto_compact(data.user_id, db)
    except Exception:
        pass

    return {
        "conversation_id": convo.id,
        "response": response,
        "messages": convo.messages,
    }


@router.post("/send/stream")
async def send_message_stream(data: MessageIn, db: AsyncSession = Depends(get_db)):
    """Stream a response, then persist when done."""
    try:
        provider = get_ai_provider()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Get or create conversation
    convo = None
    if data.conversation_id:
        convo = await db.get(Conversation, data.conversation_id)

    if not convo:
        convo = Conversation(
            user_id=data.user_id,
            entry_id=data.entry_id,
            messages=[],
        )
        db.add(convo)
        await db.commit()
        await db.refresh(convo)

    memory_context = await get_memory_context(data.user_id, db)
    system = get_system_prompt()
    if memory_context:
        system += "\n\n" + memory_context
    if data.current_step:
        system += get_step_context(data.current_step)

    # Inject current journal entry content so AI can read it
    entry_id = data.entry_id or convo.entry_id
    if entry_id:
        entry = await db.get(JournalEntry, entry_id)
        if entry and entry.content:
            system += f"\n\nCURRENT JOURNAL ENTRY (what the person has written so far):\nTitle: {entry.title}\n{entry.content}"

    messages = [{"role": "system", "content": system}]
    for msg in convo.messages:
        messages.append({"role": msg["role"], "content": msg["content"]})

    if data.template_key and len(convo.messages) == 0:
        template = get_template(data.template_key)
        if template:
            messages.append({"role": "assistant", "content": template["prompt"]})

    messages.append({"role": "user", "content": data.message})

    convo_id = convo.id
    existing_msgs = list(convo.messages)

    async def generate():
        full_response = ""
        try:
            async for chunk in provider.stream(messages):
                full_response += chunk
                yield f"data: {chunk}\n\n"
            yield f"data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
            return

        # Persist after stream completes
        try:
            from app.database import async_session
            async with async_session() as save_db:
                c = await save_db.get(Conversation, convo_id)
                if c:
                    now = datetime.now(timezone.utc).isoformat()
                    new_msgs = list(c.messages)
                    if data.template_key and len(existing_msgs) == 0:
                        tmpl = get_template(data.template_key)
                        if tmpl:
                            new_msgs.append({"role": "assistant", "content": tmpl["prompt"], "timestamp": now})
                    new_msgs.append({"role": "user", "content": data.message, "timestamp": now})
                    new_msgs.append({"role": "assistant", "content": full_response, "timestamp": now})
                    c.messages = new_msgs
                    c.updated_at = datetime.now(timezone.utc)
                    await save_db.commit()

                    # Extract memories + auto-compact
                    text = f"User said: {data.message}\nAI responded: {full_response}"
                    await extract_memories(text, data.user_id, "conversation", convo_id, save_db)
                    await maybe_auto_compact(data.user_id, save_db)
        except Exception:
            pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Conversation-Id": convo.id},
    )


@router.post("/{conversation_id}/end")
async def end_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Mark a conversation as ended."""
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    convo.is_active = False
    convo.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": convo.id, "ended": True}


@router.get("/templates/list")
async def list_templates():
    """List all available prompt templates."""
    return get_all_templates()
