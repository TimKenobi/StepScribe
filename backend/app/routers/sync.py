"""
Sync router — offline import/export for journal data.
Complete backup of all user data: entries, moods, conversations,
memories, heroes, preferences, and attachment metadata.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    JournalEntry, MoodEntry, Conversation, AIMemory, UserHero,
    UserPreferences, Attachment,
)

router = APIRouter()


# ── Export models ──

class SyncEntry(BaseModel):
    id: str | None = None
    title: str = ""
    content: str = ""
    content_html: str = ""
    prompt_used: str | None = None
    is_draft: bool = True
    sections_included: dict | None = None
    created_at: str | None = None
    updated_at: str | None = None
    mood_weather: str | None = None
    mood_note: str = ""
    mood_energy: int = 5


class SyncConversation(BaseModel):
    id: str
    entry_id: str | None = None
    messages: list = []
    is_active: bool = True
    created_at: str | None = None


class SyncMemory(BaseModel):
    id: str
    category: str
    content: str
    source: str = "conversation"
    source_id: str | None = None
    is_active: bool = True
    created_at: str | None = None


class SyncHero(BaseModel):
    id: str
    name: str
    description: str = ""
    is_active: bool = True
    sort_order: int = 0


class SyncAttachment(BaseModel):
    id: str
    entry_id: str | None = None
    filename: str
    original_name: str
    content_type: str
    size_bytes: int
    caption: str = ""
    created_at: str | None = None


class SyncPreferences(BaseModel):
    faith_tradition: str = ""
    faith_notes: str = ""
    about_me: str = ""
    onboarding_complete: bool = False


class ImportRequest(BaseModel):
    user_id: str = "default"
    entries: list[SyncEntry]


class ExportResponse(BaseModel):
    entries: list[SyncEntry]
    conversations: list[SyncConversation]
    memories: list[SyncMemory]
    heroes: list[SyncHero]
    attachments: list[SyncAttachment]
    preferences: SyncPreferences | None = None
    exported_at: str


@router.get("/export")
async def export_data(user_id: str = "default", db: AsyncSession = Depends(get_db)) -> ExportResponse:
    """Full data export — complete backup of all user data."""

    # ── Entries + moods ──
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
            sections_included=e.sections_included,
            created_at=e.created_at.isoformat() if e.created_at else None,
            updated_at=e.updated_at.isoformat() if e.updated_at else None,
            mood_weather=mood.weather if mood else None,
            mood_note=mood.note if mood else "",
            mood_energy=mood.energy_level if mood else 5,
        ))

    # ── Conversations ──
    conv_stmt = select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.created_at)
    conv_result = await db.execute(conv_stmt)
    sync_conversations = [
        SyncConversation(
            id=c.id, entry_id=c.entry_id, messages=c.messages or [],
            is_active=c.is_active,
            created_at=c.created_at.isoformat() if c.created_at else None,
        )
        for c in conv_result.scalars().all()
    ]

    # ── Memories ──
    mem_stmt = select(AIMemory).where(AIMemory.user_id == user_id).order_by(AIMemory.created_at)
    mem_result = await db.execute(mem_stmt)
    sync_memories = [
        SyncMemory(
            id=m.id, category=m.category, content=m.content,
            source=m.source, source_id=m.source_id, is_active=m.is_active,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in mem_result.scalars().all()
    ]

    # ── Heroes ──
    hero_stmt = select(UserHero).where(UserHero.user_id == user_id).order_by(UserHero.sort_order)
    hero_result = await db.execute(hero_stmt)
    sync_heroes = [
        SyncHero(
            id=h.id, name=h.name, description=h.description,
            is_active=h.is_active, sort_order=h.sort_order,
        )
        for h in hero_result.scalars().all()
    ]

    # ── Attachments (metadata only — files stored separately) ──
    att_stmt = select(Attachment).where(Attachment.user_id == user_id).order_by(Attachment.created_at)
    att_result = await db.execute(att_stmt)
    sync_attachments = [
        SyncAttachment(
            id=a.id, entry_id=a.entry_id, filename=a.filename,
            original_name=a.original_name, content_type=a.content_type,
            size_bytes=a.size_bytes, caption=a.caption,
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in att_result.scalars().all()
    ]

    # ── Preferences ──
    pref_stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    pref_result = await db.execute(pref_stmt)
    pref = pref_result.scalar_one_or_none()
    sync_prefs = None
    if pref:
        sync_prefs = SyncPreferences(
            faith_tradition=pref.faith_tradition,
            faith_notes=pref.faith_notes,
            about_me=pref.about_me,
            onboarding_complete=pref.onboarding_complete,
        )

    return ExportResponse(
        entries=sync_entries,
        conversations=sync_conversations,
        memories=sync_memories,
        heroes=sync_heroes,
        attachments=sync_attachments,
        preferences=sync_prefs,
        exported_at=datetime.utcnow().isoformat(),
    )


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
