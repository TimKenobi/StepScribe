"""AI Memory router — view, manage, and search the AI's knowledge about you."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import AIMemory

router = APIRouter()


class MemoryOut(BaseModel):
    id: str
    category: str
    content: str
    source: str
    source_id: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryCreate(BaseModel):
    user_id: str = "default"
    category: str
    content: str
    source: str = "manual"


@router.get("/", response_model=list[MemoryOut])
async def list_memories(
    user_id: str = "default",
    category: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AIMemory).where(AIMemory.user_id == user_id)
    if category:
        stmt = stmt.where(AIMemory.category == category)
    stmt = stmt.order_by(desc(AIMemory.updated_at)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=MemoryOut)
async def add_memory(data: MemoryCreate, db: AsyncSession = Depends(get_db)):
    memory = AIMemory(
        user_id=data.user_id,
        category=data.category,
        content=data.content,
        source=data.source,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return memory


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    memory = await db.get(AIMemory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    await db.delete(memory)
    await db.commit()
    return {"deleted": True}


@router.patch("/{memory_id}/toggle")
async def toggle_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    memory = await db.get(AIMemory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    memory.is_active = not memory.is_active
    await db.commit()
    return {"id": memory.id, "is_active": memory.is_active}
