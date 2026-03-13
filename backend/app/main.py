import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import journal, ai, mood, heroes, export, groups, sync, faith, onboarding, memory, conversations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure data directories exist
    for d in [settings.data_dir, settings.export_dir, settings.upload_dir]:
        os.makedirs(d, exist_ok=True)
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    description="AI-powered recovery journaling — one step at a time",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(journal.router, prefix="/api/journal", tags=["journal"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(mood.router, prefix="/api/mood", tags=["mood"])
app.include_router(heroes.router, prefix="/api/heroes", tags=["heroes"])
app.include_router(faith.router, prefix="/api/faith", tags=["faith"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
