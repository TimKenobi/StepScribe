"""
Settings router — manage AI provider configuration from the UI.
Reads/writes to app_config table, applies changes to runtime settings.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import AppConfig

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
