# StepScribe

<p align="center">
  <img src="website/img/logo.png" alt="StepScribe Logo" width="280">
</p>

<p align="center">
  <strong>AI-powered recovery journaling — one step at a time.</strong>
</p>

<p align="center">
  <a href="https://github.com/TimKenobi/StepScribe/releases/latest">📥 Download</a> &nbsp;·&nbsp;
  <a href="https://stepscribe.org">🌐 Website</a> &nbsp;·&nbsp;
  <a href="https://lumenfidei.tech">✝️ Lumen Fidei</a> &nbsp;·&nbsp;
  <a href="https://buymeacoffee.com/timkenobi">☕ Buy Me a Coffee</a>
</p>

<p align="center">
  <a href="https://github.com/TimKenobi/StepScribe/releases"><img src="https://img.shields.io/github/v/release/TimKenobi/StepScribe?include_prereleases&style=flat-square&color=6b8aaf" alt="Latest Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" alt="License: AGPL-3.0"></a>
</p>

StepScribe is a private recovery journaling companion designed for people in addiction recovery. It pairs a rich journaling experience with a persistent AI companion that learns about you over time — like a sponsor who actually remembers what you told them last week.

Inspired by AA's approach — StepScribe doesn't dictate a Higher Power. You define your own faith, heroes, and traditions in your own words.

Available as a **native desktop app** (macOS, Windows, Linux) or as a **self-hosted Docker** deployment.

---

## Features

### Journaling
- Rich text editor with TipTap (bold, italic, headings, lists, blockquotes)
- Voice-to-text dictation
- Photo and file attachments (images, PDFs, text files)
- Draft and publish workflow
- Section toggles — include/exclude mood, AI chat, and hero quotes per entry
- Offline support with local storage fallback

### AI Sponsor
- Persistent conversations that carry across sessions
- Full memory system — the AI extracts insights from every journal entry and conversation
- Learns your struggles, strengths, patterns, triggers, relationships, and milestones
- 12 guided prompt templates (morning reflection, step work, resentment inventory, etc.)
- Draws on your heroes' wisdom naturally in conversation
- Adapts to your faith tradition and personal preferences

### AI Memory
- Automatic extraction from journals and conversations
- **Auto-compaction** — when memories accumulate, the AI automatically merges and summarizes related insights to keep context focused and relevant
- Manual compaction — trigger memory consolidation on demand per category
- 9 memory categories: Struggles, Strengths, Patterns, Relationships, Triggers, Insights, Preferences, Milestones, Background
- Manual memory management — add, toggle, or delete what the AI knows
- Full context injected into every AI interaction
- "What should I know about you?" onboarding step
- Robust JSON extraction using Ollama's `format: "json"` mode for reliable memory parsing

### Inner Weather (Mood Tracking)
- 12 poetic mood states (no emojis) — from "Storm" to "Clear Skies"
- Energy level tracking (1–10)
- Mood history and trends
- Integrated into journal entries

### Heroes & Wisdom
- Add anyone who inspires you — mentors, authors, spiritual figures, philosophers
- Daily rotating quotes from your heroes
- Toggle heroes active/inactive
- Hero wisdom feeds into AI context

### Faith & Tradition
- Describe your faith and tradition in your own words
- Free-text input — not a pre-set list
- Faith context shapes AI personality and language
- Works for any belief system or secular approach

### One Day at a Time
- Calendar view with clickable days
- Month navigation (forward/backward)
- Entry detail panel — click a day to see entries and mood
- Stats: total entries, this month, mood check-ins
- Mood trend visualization (last 14 days)
- No streaks, no pressure — just showing up

### Export & Sharing
- Export journal as a formatted **Markdown book** (desktop) or **PDF book** (Docker)
- JSON export/import for backup
- Group journals with invite codes
- Share entries with your group

### Ollama Integration
- Automatic detection of Ollama installation (installed vs running)
- Platform-specific install instructions (macOS, Windows, Linux)
- Model pulling with streaming progress
- Model validation endpoint
- Recommended recovery-focused models (Psychologist first, plus Samantha, Llama 3.3, Qwen 3)
- Custom StepCompanion model creation from Modelfile

---

## Architecture

StepScribe has two deployment modes:

### 1. Desktop App (Electron)
A native desktop application with everything bundled — no Docker required.

| Layer | Technology |
|-------|-----------|
| **Shell** | Electron 33 |
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 |
| **Backend** | Express.js (Node.js), PGlite (embedded PostgreSQL via WASM) |
| **AI** | Strategy pattern — OpenAI, Anthropic, Grok/xAI, Ollama, Custom |
| **Editor** | TipTap rich text editor |

The Express server runs inside Electron's Node.js process on port 19847. The frontend is a static export served from the same origin. Data is stored in an embedded PostgreSQL database via PGlite (WASM) — no external database installation needed.

### 2. Docker (Self-Hosted)
A containerized deployment with Python backend.

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 |
| **Backend** | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async) |
| **Database** | PostgreSQL 17 with asyncpg (async driver) |
| **AI** | Strategy pattern — OpenAI, Anthropic, Grok/xAI, Ollama, Custom |
| **Editor** | TipTap rich text editor |
| **PDF** | WeasyPrint |
| **Container** | Docker Compose |

---

## Quick Start

### Option A: Desktop App

Download the latest release for your platform from the [GitHub Releases page](https://github.com/TimKenobi/StepScribe/releases):

| Platform | Download | Notes |
|----------|----------|-------|
| **macOS (Apple Silicon)** | [`StepScribe-1.0.0-arm64.dmg`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/StepScribe-1.0.0-arm64.dmg) | M1, M2, M3, M4 Macs (2020+) |
| **macOS (Intel)** | [`StepScribe-1.0.0.dmg`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/StepScribe-1.0.0.dmg) | Pre-2020 Macs with Intel chips |
| **Windows** | [`StepScribe.Setup.1.0.0.exe`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/StepScribe.Setup.1.0.0.exe) | Windows 10+ (64-bit) |
| **Linux (AppImage)** | [`StepScribe-1.0.0.AppImage`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/StepScribe-1.0.0.AppImage) | x86_64, runs on any distro |
| **Linux (.deb)** | [`stepscribe-desktop_1.0.0_amd64.deb`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/stepscribe-desktop_1.0.0_amd64.deb) | x86_64, Debian/Ubuntu |
| **Linux (AppImage, ARM64)** | [`StepScribe-1.0.0-arm64.AppImage`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/StepScribe-1.0.0-arm64.AppImage) | ARM64, runs on any distro |
| **Linux (.deb, ARM64)** | [`stepscribe-desktop_1.0.0_arm64.deb`](https://github.com/TimKenobi/StepScribe/releases/download/v1.0.0/stepscribe-desktop_1.0.0_arm64.deb) | ARM64, Debian/Ubuntu |

> **Which Mac do I have?** Click  → About This Mac. If "Chip" says "Apple M…" → Apple Silicon. If it says "Intel" → Intel.

Open the app. The onboarding wizard will walk you through:
1. AI Provider setup (Ollama recommended — free, local, private)
2. Your faith & tradition (in your own words)
3. About you
4. Your heroes (add anyone who inspires you)
5. Done

### Option B: Docker (Self-Hosted)

```bash
# Clone the repository
git clone https://github.com/TimKenobi/StepScribe.git
cd StepScribe

# Build and start
docker compose up -d --build

# Open http://localhost:3100
```

**Default Ports:**
| Service | Port |
|---------|------|
| Frontend | `3100` |
| Backend API | `8100` |

Change in `.env` via `FRONTEND_PORT` and `BACKEND_PORT`.

### Using Ollama (Free, Local AI)

```bash
# Install Ollama: https://ollama.ai
ollama pull ALIENTELLIGENCE/psychologist
ollama serve

# Configure in the app's Settings page or .env:
AI_PROVIDER=ollama
OLLAMA_MODEL=ALIENTELLIGENCE/psychologist
```

---

## Project Structure

```
StepScribe/
├── desktop/                     # Electron desktop app
│   ├── main.js                  # Electron main process
│   ├── preload.js               # Preload script (IPC bridge)
│   ├── server/
│   │   ├── index.js             # Express.js API server (all routes)
│   │   └── ai.js                # AI provider strategy pattern
│   ├── assets/                  # App icons (icns, ico, png)
│   ├── frontend-dist/           # Static frontend build (generated)
│   └── package.json             # Electron + electron-builder config
├── backend/                     # Python backend (Docker deployment)
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # Pydantic settings (from .env)
│   │   ├── database.py          # SQLAlchemy async engine, session, init_db
│   │   ├── models/
│   │   │   └── models.py        # All SQLAlchemy models + faith traditions
│   │   ├── routers/
│   │   │   ├── journal.py       # CRUD + memory extraction on publish
│   │   │   ├── conversations.py # Persistent conversations + memory
│   │   │   ├── memory.py        # AI memory CRUD + compaction
│   │   │   ├── export.py        # PDF book + JSON export
│   │   │   ├── ollama_manage.py # Ollama status, models, pull, create
│   │   │   ├── mood.py          # Inner Weather CRUD
│   │   │   ├── heroes.py        # Hero management + defaults
│   │   │   ├── faith.py         # Faith tradition management
│   │   │   ├── onboarding.py    # Setup wizard
│   │   │   ├── uploads.py       # File/photo upload + serving
│   │   │   ├── groups.py        # Group journals
│   │   │   ├── sync.py          # Import/export backup
│   │   │   └── app_settings.py  # AI config management
│   │   └── services/
│   │       ├── ai_service.py    # AI provider strategy pattern
│   │       ├── memory_service.py # Memory extraction + context builder
│   │       ├── export_service.py # PDF book HTML builder
│   │       └── sponsor_guidelines.py # System prompt + templates
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                    # Shared Next.js frontend
│   ├── src/app/                 # App router pages
│   ├── src/components/          # Reusable UI components
│   └── src/lib/                 # API client, types, storage
├── docker-compose.yml
└── .env.example
```

---

## API Overview

All endpoints follow the same REST structure in both deployment modes.
Desktop: `http://localhost:19847/api/` | Docker: `http://localhost:8100/api/`

| Endpoint | Description |
|----------|-------------|
| `GET/POST/PATCH/DELETE /journal/entries` | Journal CRUD |
| `POST /conversations/send` | Send message to AI (persistent) |
| `POST /conversations/send/stream` | Stream AI response |
| `GET /conversations/` | List past conversations |
| `GET/POST/DELETE/PATCH /memory/` | AI memory management |
| `POST /memory/compact` | Trigger memory compaction |
| `POST /uploads/` | Upload file/photo |
| `GET /uploads/file/{filename}` | Serve uploaded file |
| `GET/POST /mood/` | Mood tracking |
| `GET/POST/DELETE/PATCH /heroes/` | Hero management |
| `GET/PUT /faith/` | Faith tradition |
| `POST /onboarding/complete` | Complete setup wizard |
| `POST /export/journal-book` | Generate Markdown/PDF book |
| `GET /ollama/status` | Ollama health + installed detection |
| `GET /ollama/models` | List local Ollama models |
| `POST /ollama/pull` | Pull model with streaming progress |
| `POST /ollama/validate-model` | Test a model responds correctly |
| `GET /ai/templates` | Prompt templates |
| `GET/PUT /settings/` | AI configuration management |

---

## How AI Memory Works

1. **You journal or chat** — write entries, talk to the AI Sponsor
2. **AI extracts insights** — after every conversation exchange and journal publish, the AI analyzes the text and extracts categorized memories (struggles, patterns, triggers, milestones, etc.). Uses Ollama's `format: "json"` mode for reliable structured output.
3. **Memories are stored** — each insight is saved to the `ai_memories` table with category, source, and active/inactive status
4. **Context is built** — on every AI interaction, `get_memory_context()` gathers: your about_me, faith tradition, hero names, all active memories (grouped by category), and recent mood trend
5. **AI knows you** — this full context is injected into the system prompt, so the AI speaks with genuine understanding of your situation
6. **Auto-compaction** — when memories exceed 30, categories with 8+ entries are automatically merged into concise summaries to keep the context window focused

You can view, toggle, compact, and delete memories at any time on the AI Memory page.

---

## Data Persistence

**Desktop app:** Data is stored in an embedded PostgreSQL database (via PGlite WASM) in the app's data directory:
- macOS: `~/Library/Application Support/stepscribe-desktop/data/pgdata/`
- Windows: `%APPDATA%/stepscribe-desktop/data/pgdata/`
- Linux: `~/.config/stepscribe-desktop/data/pgdata/`

No external database installation required.

**Docker:** PostgreSQL runs as a container with a persistent volume:
- PostgreSQL data is in the `stepscribe-pgdata` Docker volume
- `data/exports/` — Generated exports
- `data/uploads/` — Uploaded photos and files

To back up: Docker uses `pg_dump stepscribe > backup.sql`. To reset: drop and recreate the database.

---

## Configuration

See [.env.example](.env.example) for all available settings. Key options:

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | AI backend: openai, anthropic, grok, ollama, custom |
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key |
| `GROK_API_KEY` | — | Your xAI/Grok API key |
| `OLLAMA_MODEL` | `ALIENTELLIGENCE/psychologist` | Which Ollama model to use |
| `BACKEND_PORT` | `8100` | Backend API port |
| `FRONTEND_PORT` | `3100` | Frontend port |

---

## Roadmap

- [x] **Desktop app** — Native Electron app for macOS, Windows, Linux
- [x] **AI Memory compaction** — Automatic and manual memory consolidation
- [x] **Markdown book export** — Export your journal as a formatted Markdown book
- [x] **Ollama detection** — Detects installed-but-not-running state with helpful guidance
- [ ] **Multi-user support** — Individual user accounts with authentication
- [ ] **Mobile-responsive PWA** — Installable progressive web app for phone use
- [ ] **Backup/restore** — One-click database backup and restore from the UI

---

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

---

## Support

If StepScribe has helped your recovery, consider supporting the project:

<a href="https://buymeacoffee.com/timkenobi"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-eab308?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee"></a>

Visit the website at [stepscribe.org](https://stepscribe.org).
