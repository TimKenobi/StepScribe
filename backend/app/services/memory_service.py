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

from app.config import settings
from app.models.models import AIMemory, UserPreferences, UserHero, MoodEntry, MOOD_WEATHER
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

Return a JSON object with an "insights" key containing an array of objects, each with:
- "category": one of: struggle, strength, pattern, relationship, trigger, insight, preference, milestone, background
- "content": a concise 1-2 sentence summary of the insight

Rules:
- Only extract what's actually there. Don't infer or assume.
- If there's nothing meaningful, return: {"insights": []}
- Focus on patterns, not events. "He mentions resentment toward his father often" > "He was angry today"
- Be specific. "Struggles with lust and objectifying women" > "Has struggles"
- Maximum 5 insights per extraction. Quality over quantity.
- Write in third person: "He/They..."
- Return ONLY the JSON object. No explanation, no markdown, no extra text.

Example response:
{"insights": [{"category": "struggle", "content": "He struggles with anger that comes out as sarcasm."}, {"category": "trigger", "content": "Loneliness in the evening is a major trigger for old habits."}]}
"""


def _parse_insights_from_response(response: str) -> list[dict]:
    """Robustly parse insights from AI response, handling various JSON formats."""
    text = response.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and "insights" in parsed:
            return parsed["insights"]
        if isinstance(parsed, list):
            return parsed
        return []
    except json.JSONDecodeError:
        pass

    # Try to find embedded JSON array
    import re
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return []


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
        kwargs = {}
        if settings.ai_provider == "ollama":
            kwargs["format"] = "json"
        response = await provider.chat(messages, temperature=0.3, **kwargs)
        insights = _parse_insights_from_response(response)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Memory extraction failed: {e}")
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
        faith_section = f"FAITH: {prefs.faith_tradition}."
        if prefs.faith_notes:
            faith_section += f" They shared: \"{prefs.faith_notes}\""
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


async def compact_memories(user_id: str, db: AsyncSession, category: str | None = None) -> dict:
    """Compact memories by category using AI to merge related insights."""
    stmt = select(AIMemory).where(AIMemory.user_id == user_id, AIMemory.is_active == True)
    if category:
        stmt = stmt.where(AIMemory.category == category)
    stmt = stmt.order_by(AIMemory.category, AIMemory.created_at)
    result = await db.execute(stmt)
    memories = result.scalars().all()

    if len(memories) < 3:
        return {"status": "skip", "message": "Not enough memories to compact (need at least 3).",
                "before": len(memories), "after": len(memories)}

    try:
        provider = get_ai_provider()
    except ValueError:
        return {"status": "error", "message": "No AI provider configured."}

    by_cat: dict[str, list] = {}
    for m in memories:
        by_cat.setdefault(m.category, []).append(m)

    COMPACT_PROMPT = (
        "You are a memory compaction system. Given a list of memories about a person in recovery, "
        "merge duplicates, remove redundancies, and summarize related items into fewer, denser memories.\n\n"
        "Rules:\n"
        "- Preserve all important information — don't lose facts, just compress.\n"
        "- Merge memories that say similar things into one richer statement.\n"
        "- Keep the same category for each output memory.\n"
        "- Write in third person: \"They...\" or \"He/She...\"\n"
        "- Return a JSON object: {\"compacted\": [{\"category\": \"...\", \"content\": \"...\"}]}\n"
        "- Aim to reduce the count by roughly 30-50% while keeping all key details."
    )

    total_before = 0
    total_after = 0
    errors = []

    for cat, cat_memories in by_cat.items():
        if len(cat_memories) < 2:
            continue
        total_before += len(cat_memories)

        memory_list = "\n".join(f"{i+1}. [{m.category}] {m.content}" for i, m in enumerate(cat_memories))
        messages = [
            {"role": "system", "content": COMPACT_PROMPT},
            {"role": "user", "content": f"Compact these {len(cat_memories)} memories in the \"{cat}\" category:\n\n{memory_list}"},
        ]
        try:
            kwargs = {}
            if settings.ai_provider == "ollama":
                kwargs["format"] = "json"
            response = await provider.chat(messages, temperature=0.2, **kwargs)
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            parsed = json.loads(cleaned)
            compacted = parsed.get("compacted", parsed if isinstance(parsed, list) else [])
            if not isinstance(compacted, list) or len(compacted) == 0:
                errors.append(f"{cat}: AI returned invalid result")
                continue

            # Deactivate old memories
            for m in cat_memories:
                m.is_active = False

            # Insert compacted
            for item in compacted:
                if not item.get("content"):
                    continue
                new_mem = AIMemory(
                    user_id=user_id,
                    category=item.get("category", cat),
                    content=item["content"],
                    source="compacted",
                )
                db.add(new_mem)
            total_after += len([i for i in compacted if i.get("content")])
        except Exception as e:
            errors.append(f"{cat}: {str(e)}")
            total_before -= len(cat_memories)

    await db.commit()
    untouched = len(memories) - total_before
    return {
        "status": "partial" if errors else "ok",
        "before": total_before + untouched,
        "after": total_after + untouched,
        "reduced": total_before - total_after,
        **({"errors": errors} if errors else {}),
    }


async def maybe_auto_compact(user_id: str, db: AsyncSession) -> None:
    """Auto-compact memories when count exceeds threshold."""
    import logging
    log = logging.getLogger(__name__)

    try:
        from sqlalchemy import func
        result = await db.execute(
            select(func.count()).select_from(AIMemory)
            .where(AIMemory.user_id == user_id, AIMemory.is_active == True)
        )
        count = result.scalar() or 0
        if count < 30:
            return

        log.info(f"Auto-compacting {count} memories for user {user_id}")

        try:
            provider = get_ai_provider()
        except ValueError:
            return

        for cat in CATEGORIES:
            cat_result = await db.execute(
                select(AIMemory)
                .where(AIMemory.user_id == user_id, AIMemory.category == cat, AIMemory.is_active == True)
                .order_by(desc(AIMemory.updated_at))
            )
            cat_memories = cat_result.scalars().all()
            if len(cat_memories) <= 8:
                continue

            contents = "\n- ".join(m.content for m in cat_memories)
            compact_prompt = (
                f'Merge these related memories about a person into 3-5 concise, non-redundant summaries. '
                f'Return a JSON object: {{"merged": ["summary1", "summary2", ...]}}\n\n'
                f'Memories:\n- {contents}'
            )
            try:
                kwargs = {}
                if settings.ai_provider == "ollama":
                    kwargs["format"] = "json"
                resp = await provider.chat([{"role": "system", "content": compact_prompt}], temperature=0.3, **kwargs)
                parsed = json.loads(resp.strip())
                merged = parsed.get("merged") or parsed.get("summaries") or (parsed if isinstance(parsed, list) else None)
            except Exception:
                continue

            if not merged or not isinstance(merged, list) or len(merged) == 0:
                continue

            # Deactivate old, insert merged
            for m in cat_memories:
                m.is_active = False

            for summary in merged[:5]:
                if isinstance(summary, str) and summary.strip():
                    new_mem = AIMemory(
                        user_id=user_id,
                        category=cat,
                        content=summary.strip(),
                        source="compaction",
                    )
                    db.add(new_mem)

            log.info(f"Compacted {cat}: {len(cat_memories)} → {len(merged)}")

        await db.commit()
    except Exception as e:
        log.error(f"Auto-compaction error: {e}")
