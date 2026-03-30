from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import UserHero

router = APIRouter()

# No pre-filled heroes. Users add their own during setup — people whose character they want to emulate.


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
    quotes: list[dict] = []

    model_config = {"from_attributes": True}


@router.get("/defaults")
async def get_default_heroes():
    """No default heroes — users add their own."""
    return []


@router.get("/quotes")
async def get_hero_quotes(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    """Return all quotes from user's active heroes for the quote rotator."""
    stmt = select(UserHero).where(
        UserHero.user_id == user_id, UserHero.is_active == True
    ).order_by(UserHero.sort_order)
    result = await db.execute(stmt)
    heroes = result.scalars().all()
    quotes = []
    for hero in heroes:
        hero_quotes = hero.quotes if isinstance(hero.quotes, list) else []
        for q in hero_quotes:
            if isinstance(q, dict) and q.get("text"):
                quotes.append({
                    "author": hero.name,
                    "text": q["text"],
                    "source": q.get("source", ""),
                })
    return quotes


@router.post("/search-quotes")
async def search_quotes_for_hero(data: dict):
    """Use the configured AI to find real, attributable quotes for a hero."""
    from app.services.ai_service import get_ai_provider

    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Hero name is required")

    prompt = f"""Find 5 real, famous, verified quotes by "{name}". 
Only include quotes that are genuinely attributed to this person. 
If this person is not a public figure or you cannot find verified quotes, return an empty array.
Do NOT make up quotes. Do NOT attribute quotes to the wrong person.

Return ONLY a JSON array of objects with "text" and "source" fields. Example:
[{{"text": "The quote text here.", "source": "Book or Speech name"}}]

If no verified quotes exist, return: []"""

    try:
        provider = get_ai_provider()
        response = await provider.chat(
            [{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:]).replace("```", "")
        import json
        quotes = json.loads(cleaned)
        if not isinstance(quotes, list):
            return {"quotes": []}
        # Sanitize output
        safe_quotes = []
        for q in quotes[:10]:
            if isinstance(q, dict) and q.get("text"):
                safe_quotes.append({
                    "text": str(q["text"])[:500],
                    "source": str(q.get("source", ""))[:200],
                })
        return {"quotes": safe_quotes}
    except Exception:
        return {"quotes": []}


@router.patch("/{hero_id}/quotes")
async def update_hero_quotes(hero_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Save selected quotes for a hero."""
    hero = await db.get(UserHero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    quotes = data.get("quotes", [])
    # Sanitize
    safe_quotes = []
    for q in quotes[:20]:
        if isinstance(q, dict) and q.get("text"):
            safe_quotes.append({
                "text": str(q["text"])[:500],
                "source": str(q.get("source", ""))[:200],
            })
    hero.quotes = safe_quotes
    await db.commit()
    return {"id": hero.id, "quotes": hero.quotes}


@router.get("/", response_model=list[HeroOut])
async def list_heroes(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    stmt = select(UserHero).where(UserHero.user_id == user_id).order_by(UserHero.sort_order)
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
