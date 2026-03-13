from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.ai_service import get_ai_provider
from app.services.sponsor_guidelines import (
    get_system_prompt_with_heroes,
    get_all_templates,
    get_template,
    PROMPT_TEMPLATES,
)

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []
    hero_names: list[str] = []
    template_key: str | None = None
    faith_tradition: str = ""
    faith_notes: str = ""


class GeneratePromptRequest(BaseModel):
    context: str  # what the user is dealing with
    hero_names: list[str] = []


@router.post("/chat")
async def chat(request: ChatRequest):
    """Send a message to the AI sponsor and get a response."""
    try:
        provider = get_ai_provider()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    system = get_system_prompt_with_heroes(request.hero_names, request.faith_tradition, request.faith_notes)
    messages = [{"role": "system", "content": system}]
    messages.extend(request.conversation_history)

    # If a template was chosen, use its prompt as context
    if request.template_key:
        template = get_template(request.template_key)
        if template:
            messages.append({
                "role": "assistant",
                "content": template["prompt"],
            })

    messages.append({"role": "user", "content": request.message})

    try:
        response = await provider.chat(messages)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream a response from the AI sponsor."""
    try:
        provider = get_ai_provider()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    system = get_system_prompt_with_heroes(request.hero_names, request.faith_tradition, request.faith_notes)
    messages = [{"role": "system", "content": system}]
    messages.extend(request.conversation_history)

    if request.template_key:
        template = get_template(request.template_key)
        if template:
            messages.append({"role": "assistant", "content": template["prompt"]})

    messages.append({"role": "user", "content": request.message})

    async def generate():
        try:
            async for chunk in provider.stream(messages):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/templates")
async def list_templates():
    """List all available prompt templates."""
    return get_all_templates()


@router.post("/generate-prompt")
async def generate_custom_prompt(request: GeneratePromptRequest):
    """Have the AI create a personalized prompt based on what the user needs."""
    try:
        provider = get_ai_provider()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    meta_prompt = (
        "You are helping create a journaling prompt for someone in recovery. "
        "Based on what they're dealing with, write ONE thoughtful prompt that will help them "
        "dig into what matters. Write it in second person, conversational, warm but direct. "
        "Don't explain it — just write the prompt itself. Keep it to 2-4 sentences."
    )

    messages = [
        {"role": "system", "content": meta_prompt},
        {"role": "user", "content": f"What I'm dealing with: {request.context}"},
    ]

    try:
        prompt = await provider.chat(messages, temperature=0.8)
        return {"prompt": prompt}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")
