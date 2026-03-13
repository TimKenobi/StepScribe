from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import JournalEntry
from app.services.memory_service import extract_memories

router = APIRouter()


class EntryCreate(BaseModel):
    user_id: str = "default"
    title: str = ""
    content: str = ""
    content_html: str = ""
    prompt_used: str | None = None
    is_draft: bool = True
    sections_included: dict | None = None


class EntryUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    content_html: str | None = None
    is_draft: bool | None = None
    sections_included: dict | None = None


class EntryOut(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    content_html: str
    prompt_used: str | None
    is_draft: bool
    sections_included: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.post("/entries", response_model=EntryOut)
async def create_entry(data: EntryCreate, db: AsyncSession = Depends(get_db)):
    entry = JournalEntry(**data.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/entries", response_model=list[EntryOut])
async def list_entries(
    user_id: str = "default",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.user_id == user_id)
        .order_by(desc(JournalEntry.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/entries/{entry_id}", response_model=EntryOut)
async def get_entry(entry_id: str, db: AsyncSession = Depends(get_db)):
    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/entries/{entry_id}", response_model=EntryOut)
async def update_entry(entry_id: str, data: EntryUpdate, db: AsyncSession = Depends(get_db)):
    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    was_draft = entry.is_draft
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)
    entry.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(entry)

    # Extract memories when publishing (draft -> not draft)
    if was_draft and not entry.is_draft and entry.content:
        try:
            await extract_memories(entry.content, entry.user_id, "journal", entry.id, db)
        except Exception:
            pass

    return entry


@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, db: AsyncSession = Depends(get_db)):
    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": True}
