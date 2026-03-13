"""
Sync router — offline import/export for journal data.
Users can export their data as JSON, work offline, then import changes back.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import JournalEntry, MoodEntry

router = APIRouter()


class SyncEntry(BaseModel):
    id: str | None = None
    title: str = ""
    content: str = ""
    content_html: str = ""
    prompt_used: str | None = None
    is_draft: bool = True
    created_at: str | None = None
    updated_at: str | None = None
    mood_weather: str | None = None
    mood_note: str = ""
    mood_energy: int = 5


class ImportRequest(BaseModel):
    user_id: str = "default"
    entries: list[SyncEntry]


class ExportResponse(BaseModel):
    entries: list[SyncEntry]
    exported_at: str


@router.get("/export")
async def export_data(user_id: str = "default", db: AsyncSession = Depends(get_db)) -> ExportResponse:
    """Full data export for offline backup."""
    stmt = select(JournalEntry).where(JournalEntry.user_id == user_id).order_by(JournalEntry.created_at)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    sync_entries = []
    for e in entries:
        mood_stmt = select(MoodEntry).where(MoodEntry.entry_id == e.id)
        mood_result = await db.execute(mood_stmt)
        mood = mood_result.scalar_one_or_none()

        sync_entries.append(SyncEntry(
            id=e.id,
            title=e.title,
            content=e.content,
            content_html=e.content_html,
            prompt_used=e.prompt_used,
            is_draft=e.is_draft,
            created_at=e.created_at.isoformat() if e.created_at else None,
            updated_at=e.updated_at.isoformat() if e.updated_at else None,
            mood_weather=mood.weather if mood else None,
            mood_note=mood.note if mood else "",
            mood_energy=mood.energy_level if mood else 5,
        ))

    return ExportResponse(entries=sync_entries, exported_at=datetime.utcnow().isoformat())


@router.post("/import")
async def import_data(req: ImportRequest, db: AsyncSession = Depends(get_db)):
    """Import entries from offline or backup. Upserts by ID."""
    imported_count = 0
    updated_count = 0

    for se in req.entries:
        if se.id:
            existing = await db.get(JournalEntry, se.id)
            if existing:
                existing.title = se.title
                existing.content = se.content
                existing.content_html = se.content_html
                existing.prompt_used = se.prompt_used
                existing.is_draft = se.is_draft
                existing.updated_at = datetime.utcnow()
                updated_count += 1
                continue

        entry = JournalEntry(
            user_id=req.user_id,
            title=se.title,
            content=se.content,
            content_html=se.content_html,
            prompt_used=se.prompt_used,
            is_draft=se.is_draft,
        )
        if se.created_at:
            entry.created_at = datetime.fromisoformat(se.created_at)
        db.add(entry)

        if se.mood_weather:
            mood = MoodEntry(
                user_id=req.user_id,
                entry_id=entry.id,
                weather=se.mood_weather,
                note=se.mood_note,
                energy_level=se.mood_energy,
            )
            db.add(mood)

        imported_count += 1

    await db.commit()
    return {"imported": imported_count, "updated": updated_count}
