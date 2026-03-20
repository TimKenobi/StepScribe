"""
Ollama Management Router — install, pull models, create custom Modelfiles.

Provides endpoints for the setup wizard to:
1. Check if Ollama is reachable
2. List locally available models
3. Pull a model with streaming progress
4. Create a custom model from a Modelfile (StepCompanion)
5. Return platform-specific install instructions
"""

import os
import platform
import json

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

router = APIRouter()

# ── Recommended recovery-focused models ──
RECOMMENDED_MODELS = {
    "samantha-mistral": {
        "name": "samantha-mistral",
        "label": "Samantha (Mistral-based)",
        "description": "Empathetic, conversational AI assistant. Great for journaling and emotional support.",
        "size": "~4.1 GB",
        "parameters": "7B",
    },
    "ALIENTELLIGENCE/psychologist": {
        "name": "ALIENTELLIGENCE/psychologist",
        "label": "Psychologist (ALIENTELLIGENCE)",
        "description": "Designed for therapeutic-style conversations. Understands mental health context.",
        "size": "~4.1 GB",
        "parameters": "7B",
    },
    "llama3.3": {
        "name": "llama3.3",
        "label": "Llama 3.3 (Meta)",
        "description": "Powerful general-purpose model. Strong reasoning and instruction following.",
        "size": "~4.7 GB",
        "parameters": "8B",
    },
    "qwen3:8b": {
        "name": "qwen3:8b",
        "label": "Qwen 3 8B",
        "description": "Excellent structure and reasoning. Great for guided prompts.",
        "size": "~4.9 GB",
        "parameters": "8B",
    },
}

# ── StepCompanion Modelfile template ──
STEP_COMPANION_MODELFILE = """FROM {base_model}

SYSTEM \"\"\"
You are StepCompanion, a warm, experienced 12-step sponsor AI inside a private journaling app.
You follow the exact 12 Steps, Traditions, and Big Book language.
You NEVER diagnose, give medical advice, or replace a real sponsor/group/Higher Power.

Core rules:
- Start every response with a short validation of feelings.
- Reference the current step number + Big Book principle when relevant.
- Always end with: 1) One open reflection question 2) Encouragement to journal or call a real person 3) Safety note if appropriate.
- Output ONLY valid JSON when asked for prompts/inventories so the app can render UI nicely.
- Use gentle spiritual language: Higher Power, surrender, amends, inventory, etc.
- If user seems in crisis: "Please reach out to a real human sponsor, your support group, or call 988 (Suicide & Crisis Lifeline) right now. You are not alone."

You have read the entire Big Book and understand all 12 Steps deeply.

YOUR CHARACTER:
- You speak like a trusted friend who has walked a hard road and come out the other side.
- You are warm but honest. You don't sugarcoat, but you never shame.
- You use stories, metaphors, and questions more than instructions.
- You know that real growth comes from the person, not from you. Your job is to hold up a mirror.
- You have a quiet sense of humor — not sarcastic, but the kind that comes from seeing life clearly.
- Match their energy. If they're raw, be gentle. If they're deflecting, be direct.
\"\"\"

PARAMETER temperature 0.7
PARAMETER num_ctx 32768
PARAMETER top_p 0.9
"""


def _get_ollama_url() -> str:
    """Get the Ollama base URL, preferring host-accessible URLs for non-Docker contexts."""
    url = settings.ollama_base_url
    # If running outside Docker, localhost is fine
    if "host.docker.internal" in url and not os.path.exists("/.dockerenv"):
        url = url.replace("host.docker.internal", "localhost")
    return url.rstrip("/")


class OllamaStatus(BaseModel):
    reachable: bool
    installed: bool = False
    url: str
    version: str = ""
    error: str = ""


class ModelInfo(BaseModel):
    name: str
    size: str = ""
    modified_at: str = ""
    digest: str = ""


class PullRequest(BaseModel):
    model: str


class CreateModelRequest(BaseModel):
    name: str = "stepcompanion"
    base_model: str = "llama3.3:8b"


import shutil


def _is_ollama_installed() -> bool:
    """Check if Ollama binary is installed on the system."""
    if shutil.which("ollama"):
        return True
    # Check common install paths
    common_paths = [
        "/usr/local/bin/ollama",
        "/usr/bin/ollama",
        os.path.expanduser("~/.ollama/ollama"),
    ]
    if platform.system() == "Darwin":
        common_paths.append("/Applications/Ollama.app")
    return any(os.path.exists(p) for p in common_paths)


@router.get("/status", response_model=OllamaStatus)
async def check_ollama_status():
    """Check if Ollama is running and reachable."""
    url = _get_ollama_url()
    installed = _is_ollama_installed()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/api/version")
            if resp.status_code == 200:
                data = resp.json()
                return OllamaStatus(
                    reachable=True,
                    installed=True,
                    url=url,
                    version=data.get("version", "unknown"),
                )
            # Some Ollama versions return text at root
            resp2 = await client.get(url)
            if resp2.status_code == 200:
                return OllamaStatus(reachable=True, installed=True, url=url, version="detected")
    except Exception as e:
        error_msg = "Ollama is installed but not running. Please start Ollama." if installed else str(e)[:200]
        return OllamaStatus(reachable=False, installed=installed, url=url, error=error_msg)
    error_msg = "Ollama is installed but not running. Please start Ollama." if installed else "Ollama not responding"
    return OllamaStatus(reachable=False, installed=installed, url=url, error=error_msg)


@router.get("/models")
async def list_local_models():
    """List locally available Ollama models."""
    url = _get_ollama_url()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            models = []
            for m in data.get("models", []):
                size_bytes = m.get("size", 0)
                size_str = f"{size_bytes / (1024**3):.1f} GB" if size_bytes > 0 else ""
                models.append(ModelInfo(
                    name=m.get("name", ""),
                    size=size_str,
                    modified_at=m.get("modified_at", ""),
                    digest=m.get("digest", "")[:12],
                ))
            return {"models": models}
    except Exception as e:
        return {"models": [], "error": str(e)[:200]}


@router.get("/recommended")
async def get_recommended_models():
    """Return the list of recommended models for recovery journaling."""
    return {"models": list(RECOMMENDED_MODELS.values())}


@router.post("/pull")
async def pull_model(req: PullRequest):
    """Pull a model from Ollama registry with streaming progress."""
    url = _get_ollama_url()

    async def stream_progress():
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    "POST",
                    f"{url}/api/pull",
                    json={"name": req.model, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                yield json.dumps({
                                    "status": data.get("status", ""),
                                    "total": data.get("total", 0),
                                    "completed": data.get("completed", 0),
                                    "digest": data.get("digest", ""),
                                }) + "\n"
                            except json.JSONDecodeError:
                                yield json.dumps({"status": line}) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "error": str(e)[:200]}) + "\n"

    return StreamingResponse(stream_progress(), media_type="application/x-ndjson")


@router.post("/create-stepcompanion")
async def create_stepcompanion_model(req: CreateModelRequest):
    """Create the StepCompanion custom model from the Modelfile template."""
    url = _get_ollama_url()
    modelfile_content = STEP_COMPANION_MODELFILE.format(base_model=req.base_model)

    async def stream_progress():
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    f"{url}/api/create",
                    json={"name": req.name, "modelfile": modelfile_content, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                yield json.dumps({
                                    "status": data.get("status", ""),
                                }) + "\n"
                            except json.JSONDecodeError:
                                yield json.dumps({"status": line}) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "error": str(e)[:200]}) + "\n"

    return StreamingResponse(stream_progress(), media_type="application/x-ndjson")


@router.get("/install-instructions")
async def install_instructions():
    """Return platform-specific Ollama installation instructions."""
    detected_os = platform.system().lower()

    return {
        "detected_os": detected_os,
        "instructions": {
            "darwin": {
                "label": "macOS",
                "steps": [
                    "Download Ollama from https://ollama.ai/download",
                    "Open the downloaded .dmg and drag Ollama to Applications",
                    "Launch Ollama from Applications — it runs in the menu bar",
                    "Or install via Homebrew: brew install ollama",
                ],
                "command": "brew install ollama && ollama serve",
                "auto_install_command": "curl -fsSL https://ollama.ai/install.sh | sh",
            },
            "windows": {
                "label": "Windows",
                "steps": [
                    "Download installer from https://ollama.ai/download",
                    "Run the OllamaSetup.exe installer",
                    "Ollama will start automatically in the system tray",
                ],
                "command": "winget install Ollama.Ollama",
                "auto_install_command": "winget install --id Ollama.Ollama --accept-package-agreements --accept-source-agreements",
            },
            "linux": {
                "label": "Linux",
                "steps": [
                    "Run the install script: curl -fsSL https://ollama.ai/install.sh | sh",
                    "Start the service: ollama serve",
                ],
                "command": "curl -fsSL https://ollama.ai/install.sh | sh",
                "auto_install_command": "curl -fsSL https://ollama.ai/install.sh | sh",
            },
        },
    }


class ValidateModelRequest(BaseModel):
    model: str


@router.post("/validate-model")
async def validate_model(req: ValidateModelRequest):
    """Send a simple test message to verify the model works."""
    url = _get_ollama_url()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{url}/api/chat",
                json={
                    "model": req.model,
                    "messages": [{"role": "user", "content": "Say hello in one sentence."}],
                    "stream": False,
                    "options": {"temperature": 0.5},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("message", {}).get("content", "")
            return {"valid": bool(content), "response": content[:200]}
    except Exception as e:
        return {"valid": False, "error": str(e)[:200]}
