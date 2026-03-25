from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # AI
    ai_provider: str = "openai"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-sonnet-4-20250514"
    grok_api_key: Optional[str] = None
    grok_model: str = "grok-3"
    grok_base_url: str = "https://api.x.ai/v1"
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3"
    custom_ai_base_url: Optional[str] = None
    custom_ai_api_key: Optional[str] = None
    custom_ai_model: Optional[str] = None

    # App
    app_name: str = "StepScribe"
    app_secret_key: str = "change-me-to-a-random-secret-string"
    app_env: str = "development"
    app_debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://stepscribe:stepscribe@db:5432/stepscribe"

    # Paths
    data_dir: str = "/app/data"
    export_dir: str = "/app/data/exports"
    upload_dir: str = "/app/data/uploads"

    # Voice
    whisper_api_key: Optional[str] = None
    whisper_model: str = "whisper-1"

    # Export
    journal_book_title: str = "My Recovery Journal"
    journal_book_author: str = ""

    # Groups
    enable_groups: bool = True
    group_invite_expiry_hours: int = 48

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
