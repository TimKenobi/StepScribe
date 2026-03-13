import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import JournalEntry, MoodEntry, MOOD_WEATHER
from app.services.export_service import build_journal_book_html, generate_pdf

router = APIRouter()


class BookRequest(BaseModel):
    user_id: str = "default"
    title: str | None = None
    author: str | None = None
    year: str | None = None
    dedication: str = ""
    start_date: str | None = None  # ISO date
    end_date: str | None = None


@router.post("/journal-book")
async def create_journal_book(req: BookRequest, db: AsyncSession = Depends(get_db)):
    """Generate a StoryWorth-style journal book as PDF."""
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.user_id == req.user_id)
        .where(JournalEntry.is_draft == False)
        .order_by(JournalEntry.created_at)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    if not entries:
        raise HTTPException(status_code=404, detail="No published entries to export")

    # Build entry dicts with mood data
    entry_dicts = []
    for e in entries:
        # date filter
        if req.start_date:
            start = datetime.fromisoformat(req.start_date)
            if e.created_at < start:
                continue
        if req.end_date:
            end = datetime.fromisoformat(req.end_date)
            if e.created_at > end:
                continue

        mood_info = {}
        mood_stmt = select(MoodEntry).where(MoodEntry.entry_id == e.id)
        mood_result = await db.execute(mood_stmt)
        mood = mood_result.scalar_one_or_none()
        if mood:
            w = MOOD_WEATHER.get(mood.weather, {})
            mood_info = {"mood_label": w.get("label", ""), "mood_description": w.get("description", "")}

        entry_dicts.append({
            "date": e.created_at.strftime("%B %d, %Y"),
            "title": e.title or "Untitled",
            "content_html": e.content_html or f"<p>{e.content}</p>",
            **mood_info,
        })

    html = build_journal_book_html(
        entries=entry_dicts,
        title=req.title,
        author=req.author,
        year=req.year,
        dedication=req.dedication,
    )

    filename = f"journal-book-{datetime.now().strftime('%Y%m%d-%H%M%S')}.pdf"
    output_path = os.path.join(settings.export_dir, filename)
    await generate_pdf(html, output_path)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/entries-json")
async def export_entries_json(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    """Export all entries as JSON for import/backup."""
    stmt = select(JournalEntry).where(JournalEntry.user_id == user_id).order_by(JournalEntry.created_at)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "content": e.content,
            "content_html": e.content_html,
            "prompt_used": e.prompt_used,
            "is_draft": e.is_draft,
            "created_at": e.created_at.isoformat(),
            "updated_at": e.updated_at.isoformat(),
        }
        for e in entries
    ]
