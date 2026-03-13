from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import UserPreferences, FAITH_TRADITIONS

router = APIRouter()


class FaithUpdate(BaseModel):
    user_id: str = "default"
    faith_tradition: str
    faith_notes: str = ""


class FaithOut(BaseModel):
    faith_tradition: str
    faith_notes: str
    tradition_label: str
    tradition_description: str
    figures: list[str]
    practices: list[str]


@router.get("/traditions")
async def list_traditions():
    """Return all available faith traditions."""
    return {
        key: {"label": val["label"], "description": val["description"]}
        for key, val in FAITH_TRADITIONS.items()
    }


@router.get("/", response_model=FaithOut | None)
async def get_faith(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()
    if not prefs or not prefs.faith_tradition:
        return None
    tradition = FAITH_TRADITIONS.get(prefs.faith_tradition, FAITH_TRADITIONS["other"])
    return FaithOut(
        faith_tradition=prefs.faith_tradition,
        faith_notes=prefs.faith_notes,
        tradition_label=tradition["label"],
        tradition_description=tradition["description"],
        figures=tradition.get("figures", []),
        practices=tradition.get("practices", []),
    )


@router.put("/")
async def set_faith(data: FaithUpdate, db: AsyncSession = Depends(get_db)):
    if data.faith_tradition and data.faith_tradition not in FAITH_TRADITIONS:
        raise HTTPException(status_code=400, detail=f"Unknown tradition: {data.faith_tradition}")
    stmt = select(UserPreferences).where(UserPreferences.user_id == data.user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()
    if prefs:
        prefs.faith_tradition = data.faith_tradition
        prefs.faith_notes = data.faith_notes
    else:
        prefs = UserPreferences(
            user_id=data.user_id,
            faith_tradition=data.faith_tradition,
            faith_notes=data.faith_notes,
        )
        db.add(prefs)
    await db.commit()
    tradition = FAITH_TRADITIONS.get(data.faith_tradition, FAITH_TRADITIONS["other"])
    return {
        "faith_tradition": data.faith_tradition,
        "tradition_label": tradition["label"],
        "saved": True,
    }
