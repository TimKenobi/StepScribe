import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import GroupJournal, GroupMember, SharedEntry

router = APIRouter()


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    created_by: str = "default"


class GroupOut(BaseModel):
    id: str
    name: str
    description: str
    invite_code: str
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JoinRequest(BaseModel):
    user_id: str
    invite_code: str
    role: str = "member"  # "sponsor" or "member"


class ShareRequest(BaseModel):
    entry_id: str
    group_id: str
    shared_by: str


@router.post("/", response_model=GroupOut)
async def create_group(data: GroupCreate, db: AsyncSession = Depends(get_db)):
    invite_code = secrets.token_urlsafe(12)
    group = GroupJournal(
        name=data.name,
        description=data.description,
        created_by=data.created_by,
        invite_code=invite_code,
    )
    db.add(group)
    # Add creator as sponsor
    await db.flush()
    member = GroupMember(group_id=group.id, user_id=data.created_by, role="sponsor")
    db.add(member)
    await db.commit()
    await db.refresh(group)
    return group


@router.post("/join")
async def join_group(data: JoinRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(GroupJournal).where(GroupJournal.invite_code == data.invite_code)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    # Check if already a member
    existing = await db.execute(
        select(GroupMember)
        .where(GroupMember.group_id == group.id, GroupMember.user_id == data.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member")

    member = GroupMember(group_id=group.id, user_id=data.user_id, role=data.role)
    db.add(member)
    await db.commit()
    return {"joined": True, "group_name": group.name}


@router.post("/share")
async def share_entry(data: ShareRequest, db: AsyncSession = Depends(get_db)):
    shared = SharedEntry(
        entry_id=data.entry_id,
        group_id=data.group_id,
        shared_by=data.shared_by,
    )
    db.add(shared)
    await db.commit()
    return {"shared": True}


@router.get("/{user_id}", response_model=list[GroupOut])
async def list_user_groups(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(GroupJournal)
        .join(GroupMember, GroupMember.group_id == GroupJournal.id)
        .where(GroupMember.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
