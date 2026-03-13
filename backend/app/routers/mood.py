from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import MoodEntry, MOOD_WEATHER

router = APIRouter()


class MoodCreate(BaseModel):
    user_id: str = "default"
    entry_id: str | None = None
    weather: str
    note: str = ""
    energy_level: int = 5

    @field_validator("weather")
    @classmethod
    def validate_weather(cls, v: str) -> str:
        if v not in MOOD_WEATHER:
            valid = list(MOOD_WEATHER.keys())
            raise ValueError(f"Invalid weather. Choose from: {valid}")
        return v

    @field_validator("energy_level")
    @classmethod
    def validate_energy(cls, v: int) -> int:
        if not 1 <= v <= 10:
            raise ValueError("Energy level must be between 1 and 10")
        return v


class MoodOut(BaseModel):
    id: str
    user_id: str
    entry_id: str | None
    weather: str
    weather_label: str = ""
    weather_description: str = ""
    note: str
    energy_level: int
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/weather-options")
async def weather_options():
    """Return all Inner Weather options."""
    return MOOD_WEATHER


@router.post("/", response_model=MoodOut)
async def create_mood(data: MoodCreate, db: AsyncSession = Depends(get_db)):
    mood = MoodEntry(**data.model_dump())
    db.add(mood)
    await db.commit()
    await db.refresh(mood)
    weather_info = MOOD_WEATHER.get(mood.weather, {})
    return MoodOut(
        **{k: getattr(mood, k) for k in MoodOut.model_fields if hasattr(mood, k)},
        weather_label=weather_info.get("label", ""),
        weather_description=weather_info.get("description", ""),
    )


@router.get("/history", response_model=list[MoodOut])
async def mood_history(
    user_id: str = "default",
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(MoodEntry)
        .where(MoodEntry.user_id == user_id)
        .order_by(desc(MoodEntry.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    moods = result.scalars().all()
    out = []
    for m in moods:
        info = MOOD_WEATHER.get(m.weather, {})
        out.append(MoodOut(
            id=m.id, user_id=m.user_id, entry_id=m.entry_id,
            weather=m.weather, note=m.note, energy_level=m.energy_level,
            created_at=m.created_at,
            weather_label=info.get("label", ""),
            weather_description=info.get("description", ""),
        ))
    return out
