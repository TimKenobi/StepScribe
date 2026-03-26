# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x (beta) | ✅ |

## Reporting a Vulnerability

If you discover a security vulnerability in StepScribe, **please do not open a public issue.**

Instead, please report it privately:

1. **Email:** [timkenobi@proton.me](mailto:timkenobi@proton.me)
2. **GitHub:** Use [GitHub's private vulnerability reporting](https://github.com/TimKenobi/StepScribe/security/advisories/new)

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 1 week
- **Fix (if confirmed):** As soon as possible, prioritized by severity

## Scope

The following are in scope:
- The StepScribe desktop application (Electron)
- The StepScribe Docker deployment (Python/FastAPI backend)
- The StepScribe website (stepscribe.org)
- Dependencies shipped with the app

Out of scope:
- Third-party AI providers (OpenAI, Anthropic, xAI, Ollama) — report to those providers directly
- Vulnerabilities requiring physical access to the user's machine
- Social engineering attacks

## Security Design

StepScribe is designed with privacy first:
- **Local-first data** — All journal entries and AI memories are stored locally on your machine (PGlite embedded database)
- **No telemetry** — The app does not phone home or collect analytics
- **No accounts** — No user registration, no cloud sync, no server-side storage
- **API keys stay local** — AI provider keys are stored in the app's local config, never transmitted to StepScribe servers
- **Ollama recommended** — For maximum privacy, use Ollama for fully local AI with zero data leaving your machine

Thank you for helping keep StepScribe safe for people in recovery.
