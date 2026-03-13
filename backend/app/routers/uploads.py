"""File upload router — photos, documents, attachments for journal entries."""

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import Attachment

router = APIRouter()

# Allowed file types (MIME types)
ALLOWED_TYPES = {
    # Images
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
    # Documents
    "application/pdf", "text/plain", "text/markdown",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class AttachmentOut(BaseModel):
    id: str
    user_id: str
    entry_id: str | None
    filename: str
    original_name: str
    content_type: str
    size_bytes: int
    caption: str
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}


def attachment_to_out(a: Attachment) -> dict:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "entry_id": a.entry_id,
        "filename": a.filename,
        "original_name": a.original_name,
        "content_type": a.content_type,
        "size_bytes": a.size_bytes,
        "caption": a.caption,
        "url": f"/api/uploads/file/{a.filename}",
        "created_at": a.created_at,
    }


@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Form("default"),
    entry_id: str = Form(None),
    caption: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file (photo, document). Returns attachment metadata."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Accepted: images (JPEG, PNG, GIF, WebP, HEIC), PDF, text.",
        )

    # Read file content and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10 MB.")

    # Generate safe filename
    ext = os.path.splitext(file.filename or "file")[1].lower()
    if not ext:
        ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "application/pdf": ".pdf", "text/plain": ".txt"}
        ext = ext_map.get(file.content_type, "")
    safe_name = f"{uuid.uuid4().hex}{ext}"

    # Save to disk
    upload_path = os.path.join(settings.upload_dir, safe_name)
    os.makedirs(settings.upload_dir, exist_ok=True)
    with open(upload_path, "wb") as f:
        f.write(content)

    # Save to DB
    attachment = Attachment(
        user_id=user_id,
        entry_id=entry_id if entry_id else None,
        filename=safe_name,
        original_name=file.filename or "file",
        content_type=file.content_type,
        size_bytes=len(content),
        caption=caption,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return attachment_to_out(attachment)


@router.get("/file/{filename}")
async def serve_file(filename: str):
    """Serve an uploaded file by filename."""
    # Prevent path traversal
    safe = os.path.basename(filename)
    path = os.path.join(settings.upload_dir, safe)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@router.get("/")
async def list_attachments(
    user_id: str = "default",
    entry_id: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List attachments, optionally filtered by entry."""
    stmt = select(Attachment).where(Attachment.user_id == user_id)
    if entry_id:
        stmt = stmt.where(Attachment.entry_id == entry_id)
    stmt = stmt.order_by(desc(Attachment.created_at)).limit(limit)
    result = await db.execute(stmt)
    return [attachment_to_out(a) for a in result.scalars().all()]


@router.patch("/{attachment_id}")
async def update_attachment(
    attachment_id: str,
    entry_id: str | None = None,
    caption: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Update attachment metadata (link to entry, change caption)."""
    att = await db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if entry_id is not None:
        att.entry_id = entry_id
    if caption is not None:
        att.caption = caption
    await db.commit()
    await db.refresh(att)
    return attachment_to_out(att)


@router.delete("/{attachment_id}")
async def delete_attachment(attachment_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an attachment and its file."""
    att = await db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    # Remove file from disk
    path = os.path.join(settings.upload_dir, att.filename)
    if os.path.isfile(path):
        os.remove(path)
    await db.delete(att)
    await db.commit()
    return {"deleted": True}
