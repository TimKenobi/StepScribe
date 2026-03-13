from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import UserHero

router = APIRouter()

# Default heroes — user can customize
DEFAULT_HEROES = [
    {"name": "J.R.R. Tolkien", "description": "Author of The Lord of the Rings. Showed that ordinary people can carry extraordinary burdens — and that the journey home is its own kind of courage."},
    {"name": "G.K. Chesterton", "description": "Writer and thinker. Believed that gratitude is the highest form of thought, and that wonder is the beginning of wisdom."},
    {"name": "C.S. Lewis", "description": "Author and theologian. Wrote honestly about grief, faith, and the painful process of becoming who you're meant to be."},
    {"name": "Marcus Aurelius", "description": "Roman Emperor and Stoic philosopher. Wrote Meditations as a private journal — reminders to himself about what matters and what doesn't."},
    {"name": "Epictetus", "description": "Born a slave, became a great Stoic teacher. Core teaching: focus only on what you can control — your thoughts, your choices, your responses."},
    {"name": "Seneca", "description": "Stoic philosopher and statesman. Wrote about anger, grief, and the shortness of life with unflinching honesty and practical wisdom."},
]


class HeroCreate(BaseModel):
    user_id: str = "default"
    name: str
    description: str = ""


class HeroOut(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


@router.get("/defaults")
async def get_default_heroes():
    """Return the default hero list."""
    return DEFAULT_HEROES


@router.get("/", response_model=list[HeroOut])
async def list_heroes(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    stmt = select(UserHero).where(UserHero.user_id == user_id).order_by(UserHero.sort_order)
    result = await db.execute(stmt)
    heroes = result.scalars().all()
    if not heroes:
        # Seed with defaults
        for i, h in enumerate(DEFAULT_HEROES):
            hero = UserHero(user_id=user_id, name=h["name"], description=h["description"], sort_order=i)
            db.add(hero)
        await db.commit()
        result = await db.execute(stmt)
        heroes = result.scalars().all()
    return heroes


@router.post("/", response_model=HeroOut)
async def add_hero(data: HeroCreate, db: AsyncSession = Depends(get_db)):
    hero = UserHero(**data.model_dump())
    db.add(hero)
    await db.commit()
    await db.refresh(hero)
    return hero


@router.delete("/{hero_id}")
async def remove_hero(hero_id: str, db: AsyncSession = Depends(get_db)):
    hero = await db.get(UserHero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    await db.delete(hero)
    await db.commit()
    return {"deleted": True}


@router.patch("/{hero_id}/toggle")
async def toggle_hero(hero_id: str, db: AsyncSession = Depends(get_db)):
    hero = await db.get(UserHero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    hero.is_active = not hero.is_active
    await db.commit()
    return {"id": hero.id, "is_active": hero.is_active}
