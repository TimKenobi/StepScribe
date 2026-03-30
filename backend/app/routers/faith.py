from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import UserPreferences

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
    """No pre-filled traditions — users describe their faith in their own words."""
    return {}


@router.get("/", response_model=FaithOut | None)
async def get_faith(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()
    if not prefs or (not prefs.faith_tradition and not prefs.faith_notes):
        return None
    return FaithOut(
        faith_tradition=prefs.faith_tradition,
        faith_notes=prefs.faith_notes,
        tradition_label=prefs.faith_tradition,
        tradition_description=prefs.faith_notes,
        figures=[],
        practices=[],
    )


@router.put("/")
async def set_faith(data: FaithUpdate, db: AsyncSession = Depends(get_db)):
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
    return {
        "faith_tradition": data.faith_tradition,
        "tradition_label": data.faith_tradition,
        "saved": True,
    }
