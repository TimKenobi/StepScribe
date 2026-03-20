# StepScribe Frontend

Next.js 16 frontend for StepScribe — the UI layer shared by both Desktop and Docker deployments.

## Tech Stack

- **Next.js 16** with App Router
- **React 19** with TypeScript 5
- **Tailwind CSS v4**
- **TipTap** rich text editor

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Building for Desktop (Static Export)

The desktop app uses a static export that gets served by the Express.js server:

```bash
npm run build    # Generates static files in out/
```

Copy to desktop: `cp -r out ../desktop/frontend-dist`

## Building for Docker

The Dockerfile handles the build automatically within docker compose.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main journal page (editor + AI chat + attachments) |
| `/sponsor` | Standalone AI Sponsor chat |
| `/progress` | One Day at a Time calendar |
| `/memory` | AI Memory management + compaction |
| `/heroes` | Hero management |
| `/faith` | Faith tradition picker |
| `/weather` | Inner Weather mood history |
| `/setup` | Onboarding wizard (5 steps) |
| `/export` | Export tools (book, JSON) |
| `/settings` | AI provider configuration |
| `/groups` | Group journals |

## Key Files

- `src/lib/api.ts` — API client for all endpoints
- `src/lib/types.ts` — TypeScript interfaces
- `src/lib/storage.ts` — Offline storage utilities
- `src/components/` — Reusable UI components (Editor, Sidebar, etc.)
