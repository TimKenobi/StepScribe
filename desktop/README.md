# StepScribe Desktop App

Native Electron desktop app for StepScribe — a self-contained recovery journaling companion with a built-in Express.js API server. No Docker required.

## Architecture

The desktop app bundles everything into a single package:
- **Electron 33** — Native window, system tray, macOS titlebar
- **Express.js** — Full REST API running inside Node.js on port 19847
- **PGlite** (embedded PostgreSQL via WASM) — Full PostgreSQL running inside the app, no external database needed
- **Next.js static export** — Frontend served from the same origin

Data is stored in an embedded PostgreSQL database inside the app's data directory:
- macOS: `~/Library/Application Support/stepscribe-desktop/data/pgdata/`
- Windows: `%APPDATA%/stepscribe-desktop/data/pgdata/`
- Linux: `~/.config/stepscribe-desktop/data/pgdata/`

## Prerequisites

- **Node.js 18+** — [download here](https://nodejs.org/)

No external database installation required — PostgreSQL is embedded via PGlite (WASM).

## Setup

```bash
cd desktop
npm install
```

## Development

```bash
# Build the frontend first
cd ../frontend && npm run build && cp -r out ../desktop/frontend-dist
cd ../desktop

# Start the app in development mode
npm run dev
```

## Building

### macOS (.dmg)
```bash
npm run build:mac
```

### Windows (.exe installer)
```bash
npm run build:win
```

### Linux (.AppImage + .deb)
```bash
npm run build:linux
```

### All platforms
```bash
npm run build:all
```

Build outputs go to `desktop/dist/`.

## App Icons

Icons are in `desktop/assets/`:
- `icon.icns` — macOS app icon
- `icon.ico` — Windows app icon
- `icon.png` — Linux / fallback (512x512)
- `tray-icon.png` — System tray icon

## How It Works

1. The Electron app starts and launches the Express.js API server on port 19847
2. The server connects to PostgreSQL (auto-creates the database if needed)
3. The static frontend is served from the `frontend-dist/` directory on the same origin
4. The main window loads `http://localhost:19847`
5. A system tray icon provides quick access and quit option
6. On macOS, a custom titlebar with drag region replaces the native title bar

## Key Features (Desktop-Specific)

- **Ollama detection** — Detects if Ollama is installed but not running (checks binary at common paths)
- **Model validation** — Tests that the configured model responds correctly
- **Memory auto-compaction** — Automatically merges memories when count exceeds 30
- **Markdown book export** — Export your journal as a formatted Markdown book
- **Robust JSON extraction** — Uses Ollama's `format: "json"` API flag for reliable memory parsing
- **Apple code signing** — macOS builds are signed with Developer ID for Gatekeeper
