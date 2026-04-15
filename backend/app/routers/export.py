import base64
import os
import re
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import (
    JournalEntry, MoodEntry, MOOD_WEATHER, UserHero, UserPreferences,
    AIMemory, Conversation, Attachment,
)
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
    include_conversations: bool = True
    include_heroes: bool = True
    include_memories: bool = True
    include_photos: bool = True
    include_statistics: bool = True


def _embed_images_in_html(content_html: str, upload_dir: str) -> str:
    """Replace /api/uploads/file/X refs with base64 data URIs for PDF embedding."""
    def _replace_src(match):
        filename = os.path.basename(match.group(1))
        filepath = os.path.join(upload_dir, filename)
        if os.path.isfile(filepath):
            ext = os.path.splitext(filename)[1].lower()
            mime = {
                ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".gif": "image/gif", ".webp": "image/webp",
            }.get(ext, "image/jpeg")
            with open(filepath, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            return f'src="data:{mime};base64,{b64}"'
        return match.group(0)  # leave unchanged if file not found

    return re.sub(r'src="[^"]*?/api/uploads/file/([^"]+)"', _replace_src, content_html)


@router.post("/journal-book")
async def create_journal_book(req: BookRequest, db: AsyncSession = Depends(get_db)):
    """Generate a comprehensive, professionally formatted journal book as PDF."""

    # ── Fetch published entries ──
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

    # ── User profile & preferences ──
    prefs_stmt = select(UserPreferences).where(UserPreferences.user_id == req.user_id)
    prefs_result = await db.execute(prefs_stmt)
    prefs = prefs_result.scalar_one_or_none()

    about_me = prefs.about_me if prefs else ""
    faith_label = prefs.faith_tradition if prefs else ""
    faith_description = prefs.faith_notes if prefs and prefs.faith_notes else ""

    # ── Heroes ──
    heroes_data = []
    if req.include_heroes:
        heroes_stmt = (
            select(UserHero)
            .where(UserHero.user_id == req.user_id, UserHero.is_active == True)
            .order_by(UserHero.sort_order)
        )
        heroes_result = await db.execute(heroes_stmt)
        heroes_data = [
            {"name": h.name, "description": h.description}
            for h in heroes_result.scalars().all()
        ]

    # ── AI Memories ──
    memories_data = []
    if req.include_memories:
        mem_stmt = (
            select(AIMemory)
            .where(AIMemory.user_id == req.user_id, AIMemory.is_active == True)
            .order_by(AIMemory.category, AIMemory.created_at)
        )
        mem_result = await db.execute(mem_stmt)
        memories_data = [
            {"category": m.category, "content": m.content, "source": m.source,
             "created_at": m.created_at.strftime("%B %d, %Y") if m.created_at else ""}
            for m in mem_result.scalars().all()
        ]

    # ── Build entry dicts with ALL related data ──
    entry_dicts = []
    mood_counter = Counter()
    total_words = 0

    for e in entries:
        # Date filters
        if req.start_date:
            start = datetime.fromisoformat(req.start_date)
            if e.created_at < start:
                continue
        if req.end_date:
            end = datetime.fromisoformat(req.end_date)
            if e.created_at > end:
                continue

        # Mood
        mood_info = {}
        mood_stmt = select(MoodEntry).where(MoodEntry.entry_id == e.id)
        mood_result = await db.execute(mood_stmt)
        mood = mood_result.scalar_one_or_none()
        if mood:
            w = MOOD_WEATHER.get(mood.weather, {})
            mood_info = {
                "mood_label": w.get("label", ""),
                "mood_description": w.get("description", ""),
                "mood_note": mood.note or "",
                "energy_level": mood.energy_level,
            }
            mood_counter[w.get("label", mood.weather)] += 1

        # Conversations
        conversations = []
        if req.include_conversations:
            conv_stmt = select(Conversation).where(Conversation.entry_id == e.id).order_by(Conversation.created_at)
            conv_result = await db.execute(conv_stmt)
            for conv in conv_result.scalars().all():
                messages = conv.messages or []
                conversations.append(messages)

        # Attachments (photos)
        attachments = []
        if req.include_photos:
            att_stmt = select(Attachment).where(Attachment.entry_id == e.id).order_by(Attachment.created_at)
            att_result = await db.execute(att_stmt)
            for att in att_result.scalars().all():
                if att.content_type and att.content_type.startswith("image/"):
                    filepath = os.path.join(settings.upload_dir, att.filename)
                    if os.path.isfile(filepath):
                        with open(filepath, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode()
                        attachments.append({
                            "data_uri": f"data:{att.content_type};base64,{b64}",
                            "caption": att.caption or att.original_name,
                        })

        # Embed any inline images in content HTML
        content_html = e.content_html or f"<p>{e.content}</p>"
        content_html = _embed_images_in_html(content_html, settings.upload_dir)

        # Word count
        plain = re.sub(r'<[^>]+>', '', content_html)
        total_words += len(plain.split())

        entry_dicts.append({
            "date": e.created_at.strftime("%B %d, %Y"),
            "title": e.title or "Untitled",
            "content_html": content_html,
            "prompt_used": e.prompt_used or "",
            "conversations": conversations,
            "attachments": attachments,
            **mood_info,
        })

    # ── Statistics ──
    statistics = {}
    if req.include_statistics and entry_dicts:
        statistics = {
            "total_entries": len(entry_dicts),
            "total_words": total_words,
            "date_range": f"{entry_dicts[0]['date']} — {entry_dicts[-1]['date']}",
            "most_common_moods": mood_counter.most_common(5),
            "total_memories": len(memories_data),
        }

    # ── Generate HTML ──
    html = build_journal_book_html(
        entries=entry_dicts,
        title=req.title,
        author=req.author,
        year=req.year,
        dedication=req.dedication,
        about_me=about_me,
        faith_label=faith_label,
        faith_description=faith_description,
        heroes=heroes_data,
        memories=memories_data,
        statistics=statistics,
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
