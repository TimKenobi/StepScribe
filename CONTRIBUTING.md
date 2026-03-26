# Contributing to StepScribe

First off — thank you for considering contributing to StepScribe. This project exists to help people in recovery, and every improvement matters.

## Code of Conduct

Be kind. People using this app may be in vulnerable situations. Keep discussions respectful, constructive, and focused on making StepScribe better.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/TimKenobi/StepScribe/issues) to avoid duplicates
2. Use the [bug report template](https://github.com/TimKenobi/StepScribe/issues/new?template=bug_report.md)
3. Include: OS, app version, steps to reproduce, expected vs actual behavior

### Suggesting Features

1. Open a [feature request](https://github.com/TimKenobi/StepScribe/issues/new?template=feature_request.md)
2. Describe the problem it solves and who it helps
3. Be open to discussion — the best ideas often evolve through conversation

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/your-feature`
3. **Make your changes** — keep commits focused and descriptive
4. **Test locally** — make sure the app builds and runs
5. **Open a Pull Request** against `main`

### Development Setup

#### Desktop App (Electron)

```bash
cd desktop
npm install
npm run dev        # Starts Electron with hot-reload frontend
```

#### Frontend Only

```bash
cd frontend
npm install
npm run dev        # Next.js dev server on http://localhost:3000
```

#### Docker (Full Stack)

```bash
cp .env.example .env
# Edit .env with your AI provider keys
docker compose up -d --build
# Frontend: http://localhost:3100
# Backend:  http://localhost:8100
```

## Architecture Overview

- **desktop/** — Electron main process, Express.js API server, PGlite database
- **frontend/** — Next.js 16, React 19, Tailwind v4 (shared between desktop and Docker)
- **backend/** — Python FastAPI backend (Docker deployment only)
- **website/** — Marketing site (Dockerized nginx)

## Guidelines

- Keep it simple — this app is for people, not for showing off
- Privacy first — never add telemetry, tracking, or cloud dependencies
- Test on the platforms you can — macOS, Windows, Linux
- Follow existing code patterns and naming conventions
- If you're unsure about a change, open an issue first to discuss

## License

By contributing, you agree that your contributions will be licensed under the [GNU General Public License v3.0](LICENSE).
