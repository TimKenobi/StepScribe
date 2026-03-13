from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import UserPreferences, UserHero, AIMemory, FAITH_TRADITIONS

router = APIRouter()

from app.routers.heroes import DEFAULT_HEROES


class OnboardingData(BaseModel):
    user_id: str = "default"
    faith_tradition: str = ""
    faith_notes: str = ""
    about_me: str = ""
    heroes: list[dict] | None = None  # [{"name": ..., "description": ...}]
    reset: bool = False


class OnboardingStatus(BaseModel):
    onboarding_complete: bool
    faith_tradition: str
    faith_label: str
    hero_count: int


@router.get("/status", response_model=OnboardingStatus)
async def get_status(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()

    hero_stmt = select(UserHero).where(UserHero.user_id == user_id, UserHero.is_active == True)
    hero_result = await db.execute(hero_stmt)
    hero_count = len(hero_result.scalars().all())

    if not prefs:
        return OnboardingStatus(
            onboarding_complete=False,
            faith_tradition="",
            faith_label="",
            hero_count=hero_count,
        )

    tradition = FAITH_TRADITIONS.get(prefs.faith_tradition, {})
    return OnboardingStatus(
        onboarding_complete=prefs.onboarding_complete,
        faith_tradition=prefs.faith_tradition,
        faith_label=tradition.get("label", ""),
        hero_count=hero_count,
    )


@router.post("/complete")
async def complete_onboarding(data: OnboardingData, db: AsyncSession = Depends(get_db)):
    stmt = select(UserPreferences).where(UserPreferences.user_id == data.user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()

    if data.reset:
        # Reset mode
        if prefs:
            prefs.faith_tradition = ""
            prefs.faith_notes = ""
            prefs.about_me = ""
            prefs.onboarding_complete = False
        else:
            prefs = UserPreferences(
                user_id=data.user_id,
                onboarding_complete=False,
            )
            db.add(prefs)

        # Clear all heroes
        hero_stmt = select(UserHero).where(UserHero.user_id == data.user_id)
        hero_result = await db.execute(hero_stmt)
        for h in hero_result.scalars().all():
            await db.delete(h)

        await db.commit()
        return {
            "onboarding_complete": False,
            "message": "Onboarding has been reset"
        }

    # Normal completion path
    if prefs:
        prefs.faith_tradition = data.faith_tradition
        prefs.faith_notes = data.faith_notes
        prefs.about_me = data.about_me
        prefs.onboarding_complete = True
    else:
        prefs = UserPreferences(
            user_id=data.user_id,
            faith_tradition=data.faith_tradition,
            faith_notes=data.faith_notes,
            about_me=data.about_me,
            onboarding_complete=True,
        )
        db.add(prefs)

    # Save heroes if provided
    if data.heroes is not None:
        hero_stmt = select(UserHero).where(UserHero.user_id == data.user_id)
        hero_result = await db.execute(hero_stmt)
        for h in hero_result.scalars().all():
            await db.delete(h)
        for i, h in enumerate(data.heroes):
            hero = UserHero(
                user_id=data.user_id,
                name=h["name"],
                description=h.get("description", ""),
                sort_order=i,
            )
            db.add(hero)

    # Clear old onboarding memories before creating new ones (avoid duplicates)
    old_mem_stmt = select(AIMemory).where(
        AIMemory.user_id == data.user_id, AIMemory.source == "onboarding"
    )
    old_mem_result = await db.execute(old_mem_stmt)
    for old_mem in old_mem_result.scalars().all():
        await db.delete(old_mem)

    # Create AI memory from about_me if provided
    if data.about_me and data.about_me.strip():
        memory = AIMemory(
            user_id=data.user_id,
            category="preference",
            content=f"User shared during onboarding: {data.about_me.strip()}",
            source="onboarding",
        )
        db.add(memory)

    # Create AI memory from faith notes if provided
    if data.faith_notes and data.faith_notes.strip():
        faith_memory = AIMemory(
            user_id=data.user_id,
            category="preference",
            content=f"Faith background: {data.faith_notes.strip()}",
            source="onboarding",
        )
        db.add(faith_memory)

    await db.commit()

    # Return suggested figures from tradition
    tradition = FAITH_TRADITIONS.get(data.faith_tradition, {})
    return {
        "onboarding_complete": True,
        "suggested_figures": tradition.get("figures", []),
        "suggested_practices": tradition.get("practices", []),
    }
