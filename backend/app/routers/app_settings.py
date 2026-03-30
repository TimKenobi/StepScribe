"""
Settings router — manage AI provider configuration from the UI.
Reads/writes to app_config table, applies changes to runtime settings.
"""

import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import (
    AppConfig, JournalEntry, MoodEntry, Conversation, AIMemory,
    UserHero, UserPreferences, Attachment, SharedEntry, GroupMember, GroupJournal,
)

router = APIRouter()


def _mask_key(key: str) -> str:
    """Mask an API key for display: show first 8 and last 4 chars."""
    if not key or len(key) < 16:
        return "••••••••" if key else ""
    return key[:8] + "•" * (len(key) - 12) + key[-4:]


# ── Field map: AppConfig column → settings attribute ──
_FIELDS = [
    "ai_provider", "openai_api_key", "openai_model",
    "anthropic_api_key", "anthropic_model",
    "grok_api_key", "grok_model", "grok_base_url",
    "ollama_base_url", "ollama_model",
    "custom_ai_base_url", "custom_ai_api_key", "custom_ai_model",
]

_KEY_FIELDS = {"openai_api_key", "anthropic_api_key", "grok_api_key", "custom_ai_api_key"}


def apply_config_to_settings(config: AppConfig) -> None:
    """Apply DB config values to the runtime settings singleton.
    Only overrides non-empty values so .env defaults still work."""
    for field in _FIELDS:
        val = getattr(config, field, "")
        if val:  # Only override if the DB has a value
            setattr(settings, field, val)


class AIConfigOut(BaseModel):
    ai_provider: str = ""
    openai_api_key_set: bool = False
    openai_api_key_masked: str = ""
    openai_model: str = ""
    anthropic_api_key_set: bool = False
    anthropic_api_key_masked: str = ""
    anthropic_model: str = ""
    grok_api_key_set: bool = False
    grok_api_key_masked: str = ""
    grok_model: str = ""
    grok_base_url: str = ""
    ollama_base_url: str = ""
    ollama_model: str = ""
    custom_ai_base_url: str = ""
    custom_ai_api_key_set: bool = False
    custom_ai_api_key_masked: str = ""
    custom_ai_model: str = ""
    # Indicates which keys are ready (have a value from DB or .env)
    active_provider: str = ""
    provider_ready: bool = False


class AIConfigUpdate(BaseModel):
    ai_provider: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    grok_api_key: str | None = None
    grok_model: str | None = None
    grok_base_url: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    custom_ai_base_url: str | None = None
    custom_ai_api_key: str | None = None
    custom_ai_model: str | None = None


def _get_effective_value(field: str) -> str:
    """Get the current effective value of a settings field."""
    return getattr(settings, field, "") or ""


def _check_provider_ready(provider: str) -> bool:
    """Check if the given provider has the required config to work."""
    if provider == "openai":
        return bool(_get_effective_value("openai_api_key"))
    elif provider == "anthropic":
        return bool(_get_effective_value("anthropic_api_key"))
    elif provider == "grok":
        return bool(_get_effective_value("grok_api_key"))
    elif provider == "ollama":
        return bool(_get_effective_value("ollama_base_url"))
    elif provider == "custom":
        return bool(_get_effective_value("custom_ai_base_url"))
    return False


@router.get("/ai", response_model=AIConfigOut)
async def get_ai_config(db: AsyncSession = Depends(get_db)):
    """Get current AI configuration (keys are masked)."""
    provider = _get_effective_value("ai_provider")

    return AIConfigOut(
        ai_provider=provider,
        openai_api_key_set=bool(_get_effective_value("openai_api_key")),
        openai_api_key_masked=_mask_key(_get_effective_value("openai_api_key")),
        openai_model=_get_effective_value("openai_model") or "gpt-4o",
        anthropic_api_key_set=bool(_get_effective_value("anthropic_api_key")),
        anthropic_api_key_masked=_mask_key(_get_effective_value("anthropic_api_key")),
        anthropic_model=_get_effective_value("anthropic_model") or "claude-sonnet-4-20250514",
        grok_api_key_set=bool(_get_effective_value("grok_api_key")),
        grok_api_key_masked=_mask_key(_get_effective_value("grok_api_key")),
        grok_model=_get_effective_value("grok_model") or "grok-3",
        grok_base_url=_get_effective_value("grok_base_url") or "https://api.x.ai/v1",
        ollama_base_url=_get_effective_value("ollama_base_url") or "http://host.docker.internal:11434",
        ollama_model=_get_effective_value("ollama_model") or "llama3",
        custom_ai_base_url=_get_effective_value("custom_ai_base_url"),
        custom_ai_api_key_set=bool(_get_effective_value("custom_ai_api_key")),
        custom_ai_api_key_masked=_mask_key(_get_effective_value("custom_ai_api_key")),
        custom_ai_model=_get_effective_value("custom_ai_model"),
        active_provider=provider,
        provider_ready=_check_provider_ready(provider),
    )


@router.put("/ai")
async def update_ai_config(data: AIConfigUpdate, db: AsyncSession = Depends(get_db)):
    """Update AI configuration. Saves to DB and applies to runtime."""
    stmt = select(AppConfig).where(AppConfig.id == "default")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config:
        config = AppConfig(id="default")
        db.add(config)

    # Update only fields that were provided (not None)
    for field in _FIELDS:
        new_val = getattr(data, field, None)
        if new_val is not None:
            setattr(config, field, new_val)

    await db.commit()
    await db.refresh(config)

    # Apply to runtime
    apply_config_to_settings(config)

    provider = _get_effective_value("ai_provider")
    return {
        "status": "ok",
        "active_provider": provider,
        "provider_ready": _check_provider_ready(provider),
    }


@router.post("/ai/test")
async def test_ai_connection(db: AsyncSession = Depends(get_db)):
    """Test the current AI provider connection with a simple prompt."""
    from app.services.ai_service import get_ai_provider

    provider_name = _get_effective_value("ai_provider")
    if not _check_provider_ready(provider_name):
        return {
            "status": "error",
            "provider": provider_name,
            "message": f"Provider '{provider_name}' is not configured. Please add an API key.",
        }

    try:
        provider = get_ai_provider()
        response = await provider.chat(
            [{"role": "user", "content": "Say 'Connection successful' in exactly two words."}],
            temperature=0.1,
        )
        return {
            "status": "ok",
            "provider": provider_name,
            "message": response.strip()[:200],
        }
    except Exception as e:
        return {
            "status": "error",
            "provider": provider_name,
            "message": str(e)[:300],
        }


# ── Factory Reset ──

def _hash_password(password: str) -> str:
    """Hash a password with PBKDF2 + random salt."""
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha512", password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{h}"


def _verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored salt:hash."""
    if not stored or ":" not in stored:
        return False
    salt, h = stored.split(":", 1)
    check = hashlib.pbkdf2_hmac("sha512", password.encode(), salt.encode(), 100000).hex()
    return check == h


@router.post("/reset-all")
async def factory_reset(data: dict, db: AsyncSession = Depends(get_db)):
    """Factory reset — clear ALL user data. Preserves AI provider config."""
    if data.get("confirmation") != "RESET":
        raise HTTPException(status_code=400, detail="Type RESET to confirm factory reset.")

    # Delete in dependency order
    await db.execute(delete(Conversation))
    await db.execute(delete(AIMemory))
    await db.execute(delete(MoodEntry))
    await db.execute(delete(SharedEntry))
    await db.execute(delete(Attachment))
    await db.execute(delete(GroupMember))
    await db.execute(delete(GroupJournal))
    await db.execute(delete(UserHero))
    await db.execute(delete(JournalEntry))

    # Reset preferences
    stmt = select(UserPreferences).where(UserPreferences.user_id == "default")
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()
    if prefs:
        prefs.faith_tradition = ""
        prefs.faith_notes = ""
        prefs.about_me = ""
        prefs.onboarding_complete = False

    # Clear password but keep AI config
    cfg_stmt = select(AppConfig).where(AppConfig.id == "default")
    cfg_result = await db.execute(cfg_stmt)
    cfg = cfg_result.scalar_one_or_none()
    if cfg:
        cfg.app_password_hash = ""

    await db.commit()
    return {"status": "ok", "message": "All data has been reset."}


# ── Password Protection ──

@router.get("/password")
async def has_password(db: AsyncSession = Depends(get_db)):
    """Check if a password is set."""
    stmt = select(AppConfig).where(AppConfig.id == "default")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    return {"has_password": bool(config and config.app_password_hash)}


@router.post("/password")
async def set_password(data: dict, db: AsyncSession = Depends(get_db)):
    """Set or change the app password."""
    password = data.get("password", "")
    current_password = data.get("current_password", "")

    if not password or len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    stmt = select(AppConfig).where(AppConfig.id == "default")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    # If changing password, verify current one
    if config and config.app_password_hash:
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password required.")
        if not _verify_password(current_password, config.app_password_hash):
            raise HTTPException(status_code=403, detail="Current password is incorrect.")

    if not config:
        config = AppConfig(id="default")
        db.add(config)

    config.app_password_hash = _hash_password(password)
    await db.commit()
    return {"status": "ok", "has_password": True}


@router.post("/verify-password")
async def verify_password(data: dict, db: AsyncSession = Depends(get_db)):
    """Verify the app password."""
    stmt = select(AppConfig).where(AppConfig.id == "default")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config or not config.app_password_hash:
        return {"verified": True}  # No password set

    password = data.get("password", "")
    if not password:
        return {"verified": False}

    return {"verified": _verify_password(password, config.app_password_hash)}


@router.delete("/password")
async def remove_password(data: dict, db: AsyncSession = Depends(get_db)):
    """Remove app password protection."""
    stmt = select(AppConfig).where(AppConfig.id == "default")
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config or not config.app_password_hash:
        return {"status": "ok", "has_password": False}

    password = data.get("password", "")
    if not password:
        raise HTTPException(status_code=400, detail="Password required to remove protection.")
    if not _verify_password(password, config.app_password_hash):
        raise HTTPException(status_code=403, detail="Incorrect password.")

    config.app_password_hash = ""
    await db.commit()
    return {"status": "ok", "has_password": False}


# ── Step tracking ──

@router.get("/current-step")
async def get_current_step(user_id: str = "default", db: AsyncSession = Depends(get_db)):
    """Get the user's current step."""
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()
    return {"current_step": prefs.current_step if prefs else 0}


@router.put("/current-step")
async def set_current_step(data: dict, user_id: str = "default", db: AsyncSession = Depends(get_db)):
    """Set the user's current step (0 = none, 1-12)."""
    step = data.get("step", 0)
    if not isinstance(step, int) or step < 0 or step > 12:
        raise HTTPException(status_code=400, detail="Step must be 0-12.")

    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await db.execute(stmt)
    prefs = result.scalar_one_or_none()

    if prefs:
        prefs.current_step = step
    else:
        from app.models.models import UserPreferences as UP
        prefs = UP(user_id=user_id, current_step=step)
        db.add(prefs)

    await db.commit()
    return {"current_step": step}
