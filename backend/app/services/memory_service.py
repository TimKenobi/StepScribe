"""
AI Memory Service — the brain that learns about you.

Like a sponsor who actually remembers what you told them last week.
Extracts insights from journal entries, conversations, and mood patterns,
then feeds them back into the AI context so it can serve you better.
"""

import json
from datetime import datetime

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AIMemory, UserPreferences, UserHero, MoodEntry, FAITH_TRADITIONS, MOOD_WEATHER
from app.services.ai_service import get_ai_provider

# Memory categories
CATEGORIES = [
    "struggle",      # Things you're fighting: addiction, anger, lust, despair
    "strength",      # What you're good at, what keeps you going
    "pattern",       # Recurring behaviors: pedestalizing, avoidance, isolation
    "relationship",  # Key people in your life and dynamics with them
    "trigger",       # What sets you off
    "insight",       # Breakthroughs, realizations
    "preference",    # How you like to be talked to, what resonates
    "milestone",     # Sobriety dates, achievements, turning points
    "background",    # Life context: job, family, history
]

EXTRACT_PROMPT = """You are analyzing a recovery journal entry or conversation to extract key insights about the person.
Extract ONLY genuinely meaningful information — things a sponsor would remember.

Return a JSON array of objects, each with:
- "category": one of: struggle, strength, pattern, relationship, trigger, insight, preference, milestone, background
- "content": a concise 1-2 sentence summary of the insight

Rules:
- Only extract what's actually there. Don't infer or assume.
- If there's nothing meaningful, return an empty array: []
- Focus on patterns, not events. "He mentions resentment toward his father often" > "He was angry today"
- Be specific. "Struggles with lust and objectifying women" > "Has struggles"
- Maximum 5 insights per extraction. Quality over quantity.
- Write in third person: "He/They..."

Examples of good extractions:
{"category": "struggle", "content": "He struggles with anger that comes out as sarcasm and passive aggression."}
{"category": "pattern", "content": "He tends to pedestalize women and then feel crushed when they disappoint him."}
{"category": "trigger", "content": "Loneliness in the evening is a major trigger for old habits."}
{"category": "milestone", "content": "60 days sober as of this entry."}
{"category": "relationship", "content": "Has a complicated relationship with his father — feels unseen."}
{"category": "insight", "content": "Realized that his need to control comes from fear of abandonment."}
"""


async def extract_memories(
    text: str,
    user_id: str,
    source: str,
    source_id: str | None,
    db: AsyncSession,
) -> list[AIMemory]:
    """Extract insights from text and store as AI memories."""
    try:
        provider = get_ai_provider()
    except ValueError:
        return []

    messages = [
        {"role": "system", "content": EXTRACT_PROMPT},
        {"role": "user", "content": text},
    ]

    try:
        response = await provider.chat(messages, temperature=0.3)
        # Parse JSON from response
        response = response.strip()
        if response.startswith("```"):
            response = response.split("\n", 1)[1].rsplit("```", 1)[0]
        insights = json.loads(response)
    except Exception:
        return []

    if not isinstance(insights, list):
        return []

    created = []
    for item in insights[:5]:  # Cap at 5
        if not isinstance(item, dict):
            continue
        category = item.get("category", "").strip()
        content = item.get("content", "").strip()
        if category not in CATEGORIES or not content:
            continue

        memory = AIMemory(
            user_id=user_id,
            category=category,
            content=content,
            source=source,
            source_id=source_id,
        )
        db.add(memory)
        created.append(memory)

    if created:
        await db.commit()
        for m in created:
            await db.refresh(m)

    return created


async def get_memory_context(user_id: str, db: AsyncSession) -> str:
    """Build a memory context string for the AI system prompt.
    Gathers: about_me, faith, heroes, recent memories, recent mood trend."""

    parts = []

    # 1. User preferences (about_me, faith)
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()

    if prefs and prefs.about_me:
        parts.append(f"ABOUT THIS PERSON (their own words): \"{prefs.about_me}\"")

    if prefs and prefs.faith_tradition:
        tradition = FAITH_TRADITIONS.get(prefs.faith_tradition, {})
        label = tradition.get("label", prefs.faith_tradition)
        figures = tradition.get("figures", [])
        practices = tradition.get("practices", [])
        faith_section = f"FAITH: {label}."
        if prefs.faith_notes:
            faith_section += f" They shared: \"{prefs.faith_notes}\""
        if figures:
            faith_section += f" Key figures: {', '.join(figures)}."
        if practices:
            faith_section += f" Practices: {', '.join(practices)}."
        parts.append(faith_section)

    # 2. Heroes
    hero_stmt = select(UserHero).where(
        UserHero.user_id == user_id, UserHero.is_active == True
    ).order_by(UserHero.sort_order)
    hero_result = await db.execute(hero_stmt)
    heroes = hero_result.scalars().all()
    if heroes:
        names = [h.name for h in heroes]
        parts.append(
            f"HEROES THEY DRAW INSPIRATION FROM: {', '.join(names)}. "
            f"Reference their wisdom when it fits naturally."
        )

    # 3. AI Memories — grouped by category
    mem_stmt = (
        select(AIMemory)
        .where(AIMemory.user_id == user_id, AIMemory.is_active == True)
        .order_by(desc(AIMemory.updated_at))
        .limit(50)
    )
    mem_result = await db.execute(mem_stmt)
    memories = mem_result.scalars().all()

    if memories:
        by_cat: dict[str, list[str]] = {}
        for m in memories:
            by_cat.setdefault(m.category, []).append(m.content)

        mem_lines = ["WHAT YOU KNOW ABOUT THIS PERSON (learned over time):"]
        cat_labels = {
            "struggle": "Struggles",
            "strength": "Strengths",
            "pattern": "Patterns",
            "relationship": "Relationships",
            "trigger": "Triggers",
            "insight": "Insights they've had",
            "preference": "Preferences",
            "milestone": "Milestones",
            "background": "Background",
        }
        for cat in CATEGORIES:
            items = by_cat.get(cat, [])
            if items:
                label = cat_labels.get(cat, cat.title())
                mem_lines.append(f"  {label}: " + " | ".join(items[:5]))
        parts.append("\n".join(mem_lines))

    # 4. Recent mood trend
    mood_stmt = (
        select(MoodEntry)
        .where(MoodEntry.user_id == user_id)
        .order_by(desc(MoodEntry.created_at))
        .limit(7)
    )
    mood_result = await db.execute(mood_stmt)
    moods = mood_result.scalars().all()
    if moods:
        trend = []
        for m in reversed(moods):
            w = MOOD_WEATHER.get(m.weather, {})
            label = w.get("label", m.weather)
            trend.append(label)
        parts.append(f"RECENT INNER WEATHER (oldest→newest): {' → '.join(trend)}")

    if not parts:
        return ""

    return "\n\n".join(parts)
