import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    entries: Mapped[list["JournalEntry"]] = relationship(back_populates="user")
    moods: Mapped[list["MoodEntry"]] = relationship(back_populates="user")
    heroes: Mapped[list["UserHero"]] = relationship(back_populates="user")
    preferences: Mapped["UserPreferences"] = relationship(back_populates="user", uselist=False)
    memories: Mapped[list["AIMemory"]] = relationship(back_populates="user")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")


# Available faith traditions — used by onboarding and AI context
FAITH_TRADITIONS = {
    "traditional_catholic": {
        "label": "Traditional Catholic",
        "description": "Latin Mass, devotion to the Saints, Rosary, sacramental life.",
        "figures": ["St. Thomas Aquinas", "St. Augustine", "St. Thérèse of Lisieux", "St. Padre Pio", "Our Lady"],
        "practices": ["Daily Rosary", "Examination of Conscience", "Confession", "Eucharistic Adoration", "Liturgy of the Hours"],
    },
    "roman_catholic": {
        "label": "Roman Catholic",
        "description": "Novus Ordo, parish life, social teaching, sacraments.",
        "figures": ["St. Francis of Assisi", "St. Teresa of Calcutta", "St. John Paul II", "St. Ignatius of Loyola"],
        "practices": ["Mass", "Rosary", "Lectio Divina", "Works of Mercy", "Confession"],
    },
    "eastern_orthodox": {
        "label": "Eastern Orthodox",
        "description": "Divine Liturgy, icons, the Jesus Prayer, theosis.",
        "figures": ["St. John Chrysostom", "St. Seraphim of Sarov", "St. Theophan the Recluse"],
        "practices": ["Jesus Prayer", "Fasting", "Divine Liturgy", "Icon veneration", "Confession"],
    },
    "protestant": {
        "label": "Protestant / Evangelical",
        "description": "Scripture-centered, personal relationship with Christ, community.",
        "figures": ["Dietrich Bonhoeffer", "C.S. Lewis", "Charles Spurgeon", "Corrie ten Boom"],
        "practices": ["Bible study", "Prayer", "Worship", "Small groups", "Devotionals"],
    },
    "jewish": {
        "label": "Jewish",
        "description": "Torah, Talmud, mitzvot, the rhythm of Shabbat and holy days.",
        "figures": ["Rabbi Nachman of Breslov", "Maimonides", "Viktor Frankl", "Abraham Joshua Heschel"],
        "practices": ["Shabbat", "Torah study", "Prayer", "Tikkun olam", "Musar"],
    },
    "buddhist": {
        "label": "Buddhist",
        "description": "The Eightfold Path, mindfulness, compassion, letting go of attachment.",
        "figures": ["Thich Nhat Hanh", "Pema Chödrön", "The Dalai Lama", "Shunryu Suzuki"],
        "practices": ["Meditation", "Mindfulness", "Right speech", "Loving-kindness", "Sangha"],
    },
    "muslim": {
        "label": "Muslim",
        "description": "The Five Pillars, Quran, surrender to God, community (ummah).",
        "figures": ["Rumi", "Imam al-Ghazali", "Malcolm X"],
        "practices": ["Salah (prayer)", "Quran recitation", "Dhikr", "Fasting", "Charity"],
    },
    "stoic_philosophical": {
        "label": "Stoic / Philosophical",
        "description": "Virtue ethics, focus on what you can control, rational self-examination.",
        "figures": ["Marcus Aurelius", "Epictetus", "Seneca", "Viktor Frankl"],
        "practices": ["Morning reflection", "Evening review", "Negative visualization", "Journaling", "Memento mori"],
    },
    "spiritual_not_religious": {
        "label": "Spiritual but Not Religious",
        "description": "Higher Power as you understand it. The 12-step tradition of open spirituality.",
        "figures": ["Bill W.", "Carl Jung", "Joseph Campbell", "Ram Dass"],
        "practices": ["Meditation", "Gratitude", "Prayer to Higher Power", "Service", "Step work"],
    },
    "secular": {
        "label": "Secular / Non-Religious",
        "description": "Recovery through reason, community, personal responsibility, and human connection.",
        "figures": ["Albert Camus", "Viktor Frankl", "Brené Brown", "Jordan Peterson"],
        "practices": ["Journaling", "Cognitive reframing", "Community service", "Self-reflection", "Rational self-analysis"],
    },
    "other": {
        "label": "Other",
        "description": "A tradition not listed here. You can describe it and the AI will adapt.",
        "figures": [],
        "practices": [],
    },
}


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    faith_tradition: Mapped[str] = mapped_column(String(50), default="")
    faith_notes: Mapped[str] = mapped_column(Text, default="")
    about_me: Mapped[str] = mapped_column(Text, default="")
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="preferences")


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(500), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    content_html: Mapped[str] = mapped_column(Text, default="")
    prompt_used: Mapped[str] = mapped_column(Text, nullable=True)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=True)
    # Which sections are included in this entry (for review/export)
    # e.g. {"mood": true, "conversation": true, "heroes": false}
    sections_included: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="entries")
    mood: Mapped["MoodEntry"] = relationship(back_populates="entry", uselist=False)
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="entry")


# Inner Weather mood system — poetic, not emojis
MOOD_WEATHER = {
    "first_light": {"label": "First Light", "description": "Hopeful. A new beginning on the horizon.", "intensity": 8},
    "clear_skies": {"label": "Clear Skies", "description": "Peaceful and content. Steady ground.", "intensity": 9},
    "gentle_breeze": {"label": "Gentle Breeze", "description": "Light and easy. Things feel manageable.", "intensity": 7},
    "still_waters": {"label": "Still Waters", "description": "Calm, reflective. A quiet strength.", "intensity": 6},
    "partly_cloudy": {"label": "Partly Cloudy", "description": "Mixed feelings. Some sun, some shadow.", "intensity": 5},
    "overcast": {"label": "Overcast", "description": "Heavy. Carrying a weight today.", "intensity": 4},
    "fog": {"label": "Fog", "description": "Uncertain. Hard to see the path ahead.", "intensity": 3},
    "light_rain": {"label": "Light Rain", "description": "Sad but not lost. Letting things fall.", "intensity": 3},
    "rough_seas": {"label": "Rough Seas", "description": "Anxious. Waves crashing, hard to stay upright.", "intensity": 2},
    "storm": {"label": "Storm", "description": "Crisis. Everything feels overwhelming.", "intensity": 1},
    "calm_after_storm": {"label": "Calm After Storm", "description": "Exhausted but relieved. The worst has passed.", "intensity": 5},
    "dawn_breaking": {"label": "Dawn Breaking", "description": "Coming through darkness. Light is returning.", "intensity": 7},
}


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    entry_id: Mapped[str] = mapped_column(ForeignKey("journal_entries.id"), nullable=True)
    weather: Mapped[str] = mapped_column(String(50))  # key from MOOD_WEATHER
    note: Mapped[str] = mapped_column(Text, default="")
    energy_level: Mapped[int] = mapped_column(Integer, default=5)  # 1-10
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship(back_populates="moods")
    entry: Mapped["JournalEntry"] = relationship(back_populates="mood")


class UserHero(Base):
    __tablename__ = "user_heroes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="heroes")


class GroupJournal(Base):
    __tablename__ = "group_journals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    invite_code: Mapped[str] = mapped_column(String(20), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    members: Mapped[list["GroupMember"]] = relationship(back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    group_id: Mapped[str] = mapped_column(ForeignKey("group_journals.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(20), default="member")  # "sponsor" | "member"
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    group: Mapped["GroupJournal"] = relationship(back_populates="members")


class SharedEntry(Base):
    __tablename__ = "shared_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    entry_id: Mapped[str] = mapped_column(ForeignKey("journal_entries.id"))
    group_id: Mapped[str] = mapped_column(ForeignKey("group_journals.id"))
    shared_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    shared_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ──────────────────────────────────────────────
# File Attachments — photos, documents, etc.
# ──────────────────────────────────────────────
class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("journal_entries.id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    caption: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ──────────────────────────────────────────────
# AI Memory — persistent knowledge the AI learns about you
# ──────────────────────────────────────────────
class AIMemory(Base):
    __tablename__ = "ai_memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # Category: struggle, strength, pattern, relationship, trigger, insight, preference, milestone
    category: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text)
    # Source that generated this memory
    source: Mapped[str] = mapped_column(String(50), default="conversation")  # conversation, journal, mood, onboarding
    source_id: Mapped[str] = mapped_column(String(36), nullable=True)  # entry_id or conversation_id
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="memories")


# ──────────────────────────────────────────────
# Conversations — persistent chat records tied to journal entries
# ──────────────────────────────────────────────
class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("journal_entries.id"), nullable=True)
    # JSON array of {role, content, timestamp}
    messages: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # False = user ended conversation
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="conversations")
    entry: Mapped["JournalEntry"] = relationship(back_populates="conversations")


# ──────────────────────────────────────────────
# App Configuration — AI provider settings stored in DB
# ──────────────────────────────────────────────
class AppConfig(Base):
    __tablename__ = "app_config"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    ai_provider: Mapped[str] = mapped_column(String(50), default="")
    openai_api_key: Mapped[str] = mapped_column(Text, default="")
    openai_model: Mapped[str] = mapped_column(String(100), default="")
    anthropic_api_key: Mapped[str] = mapped_column(Text, default="")
    anthropic_model: Mapped[str] = mapped_column(String(100), default="")
    grok_api_key: Mapped[str] = mapped_column(Text, default="")
    grok_model: Mapped[str] = mapped_column(String(100), default="")
    grok_base_url: Mapped[str] = mapped_column(String(500), default="")
    ollama_base_url: Mapped[str] = mapped_column(String(500), default="")
    ollama_model: Mapped[str] = mapped_column(String(100), default="")
    custom_ai_base_url: Mapped[str] = mapped_column(String(500), default="")
    custom_ai_api_key: Mapped[str] = mapped_column(Text, default="")
    custom_ai_model: Mapped[str] = mapped_column(String(100), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
