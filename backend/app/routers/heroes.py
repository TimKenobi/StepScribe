from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import UserHero

router = APIRouter()

# Default heroes — Catholic core with compatible wisdom traditions
DEFAULT_HEROES = [
    # Catholic Saints & Doctors
    {"name": "St. Augustine", "description": "Bishop of Hippo, convert, Doctor of the Church. Wrote the Confessions — the original recovery story. 'Our hearts are restless until they rest in Thee.'"},
    {"name": "St. Thomas Aquinas", "description": "The Angelic Doctor. Synthesized faith and reason. Proved that thinking deeply and believing deeply are not opposites."},
    {"name": "St. Padre Pio", "description": "Capuchin friar, mystic, bearer of the stigmata. Knew suffering intimately and turned it into intercession. 'Pray, hope, and don't worry.'"},
    {"name": "St. Francis de Sales", "description": "Bishop of Geneva, Doctor of the Church. Wrote Introduction to the Devout Life — practical holiness for ordinary people living in the world."},
    {"name": "St. John of the Cross", "description": "Carmelite mystic and Doctor of the Church. The Dark Night of the Soul is the recovery journey in mystical language — purification through darkness."},
    {"name": "Matt Talbot", "description": "Dublin laborer, severe alcoholic, converted at 28. Lived 40+ years of heroic penance and prayer. Patron of addiction recovery."},
    # Catholic Writers & Thinkers
    {"name": "J.R.R. Tolkien", "description": "Devout Catholic. Called The Lord of the Rings 'a fundamentally religious and Catholic work.' Credited the Blessed Sacrament for everything good in his writing and life."},
    {"name": "G.K. Chesterton", "description": "Catholic convert, writer, and apologist. Believed that gratitude is the highest form of thought, and that wonder is the beginning of wisdom."},
    {"name": "Hilaire Belloc", "description": "Catholic historian, essayist, and poet. Fierce defender of the Faith. 'The Faith is Europe, and Europe is the Faith.'"},
    {"name": "Peter Kreeft", "description": "Catholic philosopher at Boston College. Modern-day Socrates — makes ancient wisdom accessible and alive. Convert from Calvinism."},
    {"name": "Fulton Sheen", "description": "Archbishop, television evangelist, Servant of God. Could explain the deepest theology in language anyone could understand. Master of the examined life."},
    {"name": "Flannery O'Connor", "description": "Catholic fiction writer. Grace in the grotesque. Unflinching honesty about human nature and the violent mercy of God."},
    {"name": "Scott Weeman", "description": "Founder of Catholics in Recovery. Bridges the 12 Steps and the Sacraments. Living proof that the Church and recovery work together."},
    {"name": "Blaise Pascal", "description": "Mathematician, physicist, Catholic philosopher. The Pensées are fragments of brilliance on faith, reason, and the human condition."},
    {"name": "Fr. Walter Ciszek, SJ", "description": "American Jesuit imprisoned in Soviet gulags for 23 years. Wrote He Leadeth Me — ultimate trust in God under unbearable pressure."},
    {"name": "Jacques Philippe", "description": "French priest and spiritual writer. Interior Freedom and Searching for and Maintaining Peace — deeply practical Catholic wisdom for the interior life."},
    {"name": "Dom Prosper Guéranger", "description": "Restorer of Benedictine monastic life in France. Champion of the traditional liturgy. Founded Solesmes Abbey."},
    {"name": "Archbishop Marcel Lefebvre", "description": "Founder of the SSPX. Stood firm for Tradition when the world moved on. 'We must keep the Faith.'"},
    # Compatible Wisdom (Stoics & Others)
    {"name": "C.S. Lewis", "description": "Anglican author and apologist. Close friend of Tolkien. Wrote honestly about grief, faith, and the painful process of becoming who you're meant to be."},
    {"name": "Marcus Aurelius", "description": "Roman Emperor and Stoic philosopher. Wrote Meditations as a private journal — reminders to himself about what matters and what doesn't."},
    {"name": "Epictetus", "description": "Born a slave, became a great Stoic teacher. Core teaching: focus only on what you can control — your thoughts, your choices, your responses."},
    {"name": "Seneca", "description": "Stoic philosopher and statesman. Wrote about anger, grief, and the shortness of life with unflinching honesty and practical wisdom."},
    {"name": "Viktor Frankl", "description": "Holocaust survivor. Man's Search for Meaning — found purpose inside suffering. 'He who has a why to live can bear almost any how.'"},
    {"name": "Aleksandr Solzhenitsyn", "description": "Russian Nobel laureate. Survived the Gulag. 'The line between good and evil runs through every human heart.'"},
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
