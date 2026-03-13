# StepScribe

**AI-powered recovery journaling — one step at a time.**

StepScribe is a private, self-hosted journaling companion designed for people in addiction recovery. It pairs a rich journaling experience with a persistent AI companion that learns about you over time — like a sponsor who actually remembers what you told them last week.

Built with Traditional Catholic sensibility by default, but fully adaptable to any faith tradition or secular approach.

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
- 9 memory categories: Struggles, Strengths, Patterns, Relationships, Triggers, Insights, Preferences, Milestones, Background
- Manual memory management — add, toggle, or delete what the AI knows
- Full context injected into every AI interaction
- "What should I know about you?" onboarding step

### Inner Weather (Mood Tracking)
- 12 poetic mood states (no emojis) — from "Storm" to "Clear Skies"
- Energy level tracking (1–10)
- Mood history and trends
- Integrated into journal entries

### Heroes & Wisdom
- 24 default heroes (Catholic saints, writers, Stoic philosophers)
- Daily rotating quotes from your heroes
- Add your own heroes, toggle active/inactive
- Hero wisdom feeds into AI context

### Faith & Tradition
- 11 faith traditions (Traditional Catholic, Orthodox, Protestant, Jewish, Buddhist, Muslim, Stoic, Secular, etc.)
- Tradition-specific figures and practices
- Faith context shapes AI personality and language

### One Day at a Time
- Calendar view with clickable days
- Month navigation (forward/backward)
- Entry detail panel — click a day to see entries and mood
- Stats: total entries, this month, mood check-ins
- Mood trend visualization (last 14 days)
- No streaks, no pressure — just showing up

### Export & Sharing
- Export journal as PDF book
- JSON export/import for backup
- Group journals with invite codes
- Share entries with your group

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 |
| **Backend** | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async) |
| **Database** | SQLite with aiosqlite (async driver) |
| **AI** | Strategy pattern — OpenAI, Anthropic, Grok/xAI, Ollama, Custom |
| **Editor** | TipTap rich text editor |
| **PDF** | WeasyPrint |
| **Container** | Docker Compose |

---

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Optional: API key for cloud AI (Grok, OpenAI, Anthropic). Local Ollama works without keys.

### Setup

```bash
# Clone the repository
git clone https://github.com/TimKenobi/StepScribe.git
cd StepScribe

# Build and start
docker compose up -d --build

# Open http://localhost:3100
# First visit will launch the onboarding wizard:
#   1. AI Provider & API Key
#   2. Faith Tradition
#   3. About You
#   4. Your Heroes
#   5. Done
```

**Note**: API keys can now be configured directly in the UI during onboarding or in Settings. The `.env` file is only needed for initial defaults or when using custom endpoints.

### Default Ports
| Service | Port |
|---------|------|
| Frontend | `3100` |
| Backend API | `8100` |

Change in `.env` via `FRONTEND_PORT` and `BACKEND_PORT`.

### Using Ollama (Free, Local AI)

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3
ollama serve

# In .env:
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3
```

---

## Project Structure

```
StepScribe/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # Pydantic settings (from .env)
│   │   ├── database.py          # SQLAlchemy async engine, session, init_db
│   │   ├── models/
│   │   │   └── models.py        # All SQLAlchemy models + faith traditions
│   │   ├── routers/
│   │   │   ├── journal.py       # CRUD entries + memory extraction on publish
│   │   │   ├── ai.py            # Direct AI chat (legacy, still works)
│   │   │   ├── conversations.py # Persistent conversations + memory extraction
│   │   │   ├── memory.py        # AI memory CRUD
│   │   │   ├── uploads.py       # File/photo upload + serving
│   │   │   ├── mood.py          # Inner Weather CRUD
│   │   │   ├── heroes.py        # Hero management + 24 defaults
│   │   │   ├── faith.py         # Faith tradition management
│   │   │   ├── onboarding.py    # Setup wizard (faith, heroes, about_me)
│   │   │   ├── export.py        # PDF book + JSON export
│   │   │   ├── groups.py        # Group journals
│   │   │   └── sync.py          # Import/export for backup
│   │   └── services/
│   │       ├── ai_service.py    # AI provider strategy pattern
│   │       ├── memory_service.py # Memory extraction + context builder
│   │       └── sponsor_guidelines.py # System prompt + templates
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main journal page (editor + AI chat + attachments)
│   │   │   ├── sponsor/         # Standalone AI Sponsor chat
│   │   │   ├── progress/        # One Day at a Time calendar
│   │   │   ├── memory/          # AI Memory management
│   │   │   ├── heroes/          # Hero management
│   │   │   ├── faith/           # Faith tradition picker
│   │   │   ├── weather/         # Inner Weather history
│   │   │   ├── setup/           # Onboarding wizard
│   │   │   ├── groups/          # Group journals
│   │   │   ├── export/          # Export tools
│   │   │   └── settings/        # Settings
│   │   ├── components/          # Reusable components (Editor, Sidebar, etc.)
│   │   └── lib/
│   │       ├── api.ts           # API client for all endpoints
│   │       ├── types.ts         # TypeScript interfaces
│   │       └── storage.ts       # Offline storage utilities
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── data/                        # Persistent data (DB, exports, uploads)
```

---

## API Overview

All endpoints are at `http://localhost:8100/api/`. FastAPI auto-generates docs at `/docs`.

| Endpoint | Description |
|----------|-------------|
| `GET/POST/PATCH/DELETE /journal/entries` | Journal CRUD |
| `POST /conversations/send` | Send message to AI (persistent) |
| `GET /conversations/` | List past conversations |
| `GET/POST/DELETE/PATCH /memory/` | AI memory management |
| `POST /uploads/` | Upload file/photo |
| `GET /uploads/file/{filename}` | Serve uploaded file |
| `GET/POST /mood/` | Mood tracking |
| `GET/POST/DELETE/PATCH /heroes/` | Hero management |
| `GET/PUT /faith/` | Faith tradition |
| `POST /onboarding/complete` | Complete setup wizard |
| `POST /export/journal-book` | Generate PDF book |
| `GET /ai/templates` | Prompt templates |

---

## How AI Memory Works

1. **You journal or chat** — write entries, talk to the AI Sponsor
2. **AI extracts insights** — after every conversation exchange and journal publish, the AI analyzes the text and extracts categorized memories (struggles, patterns, triggers, milestones, etc.)
3. **Memories are stored** — each insight is saved to the `ai_memories` table with category, source, and active/inactive status
4. **Context is built** — on every AI interaction, `get_memory_context()` gathers: your about_me, faith tradition, hero names, all active memories (grouped by category), and recent mood trend
5. **AI knows you** — this full context is injected into the system prompt, so the AI speaks with genuine understanding of your situation

You can view, toggle, and delete memories at any time on the AI Memory page.

---

## Data Persistence

All data lives in the `data/` directory (mapped via Docker volumes):
- `data/db/stepscribe.db` — SQLite database
- `data/exports/` — Generated PDF exports
- `data/uploads/` — Uploaded photos and files

To back up: copy the `data/` folder. To reset: delete `data/db/stepscribe.db` and restart.

---

## Configuration

See [.env.example](.env.example) for all available settings. Key options:

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | AI backend: openai, anthropic, grok, ollama, custom |
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key |
| `GROK_API_KEY` | — | Your xAI/Grok API key |
| `OLLAMA_MODEL` | `llama3` | Which Ollama model to use |
| `BACKEND_PORT` | `8100` | Backend API port |
| `FRONTEND_PORT` | `3100` | Frontend port |

---

## License

Private project. All rights reserved.
