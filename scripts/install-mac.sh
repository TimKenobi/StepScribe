#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# StepScribe — macOS Install & Launch Script
# Checks for Docker, optionally installs Ollama, starts services.
# ─────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'  # No color
BOLD='\033[1m'

echo ""
echo -e "${YELLOW}🔥 StepScribe — Recovery Journaling Companion${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Find project root (script is in /scripts/) ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Check Docker ──
echo -e "${BOLD}Checking Docker...${NC}"
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo -e "  ${GREEN}✓ Docker is running${NC}"
else
    echo -e "  ${RED}✗ Docker is not running or not installed${NC}"
    echo ""
    echo "  Docker Desktop is required to run StepScribe."
    echo "  Download it from: https://www.docker.com/products/docker-desktop/"
    echo ""
    read -p "  Would you like to open the Docker download page? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "https://www.docker.com/products/docker-desktop/"
    fi
    echo ""
    echo -e "  ${YELLOW}After installing Docker, run this script again.${NC}"
    exit 1
fi

# ── Check Docker Compose ──
if docker compose version &> /dev/null; then
    echo -e "  ${GREEN}✓ Docker Compose available${NC}"
else
    echo -e "  ${RED}✗ Docker Compose not found${NC}"
    echo "  Please update Docker Desktop to a version that includes Docker Compose v2."
    exit 1
fi

# ── Optional: Install Ollama ──
echo ""
echo -e "${BOLD}Local AI (Ollama) — Optional${NC}"
echo "  Ollama lets you run AI models locally on your Mac."
echo "  This is 100% private — nothing leaves your computer."
echo ""

INSTALL_OLLAMA=false
if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "installed")
    echo -e "  ${GREEN}✓ Ollama is already installed ($OLLAMA_VERSION)${NC}"
else
    read -p "  Would you like to install Ollama for local AI? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        INSTALL_OLLAMA=true
        echo ""
        echo "  Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
        echo -e "  ${GREEN}✓ Ollama installed${NC}"
    else
        echo -e "  ${YELLOW}→ Skipping Ollama (you can set up a cloud API in the app)${NC}"
    fi
fi

# ── Start Ollama if installed ──
if command -v ollama &> /dev/null; then
    if ! pgrep -x "ollama" > /dev/null 2>&1; then
        echo ""
        echo "  Starting Ollama service..."
        ollama serve &> /dev/null &
        sleep 2
        echo -e "  ${GREEN}✓ Ollama service started${NC}"
    fi
fi

# ── Create .env if missing ──
echo ""
echo -e "${BOLD}Checking configuration...${NC}"
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        echo -e "  ${GREEN}✓ Created .env from .env.example${NC}"
    fi
else
    echo -e "  ${GREEN}✓ .env file exists${NC}"
fi

# ── Build and start ──
echo ""
echo -e "${BOLD}Starting StepScribe...${NC}"
cd "$PROJECT_ROOT"

echo "  Building containers (this may take a few minutes on first run)..."
docker compose up --build -d

echo ""
echo "  Waiting for services to be ready..."
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8100/health > /dev/null 2>&1; then
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    printf "  ."
done
echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "  ${RED}✗ Services did not start in time. Check: docker compose logs${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ Backend is ready${NC}"

# Wait a bit more for frontend
sleep 3
echo -e "  ${GREEN}✓ Frontend is ready${NC}"

# ── Open in browser ──
FRONTEND_PORT=${FRONTEND_PORT:-3100}
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🔥 StepScribe is running!${NC}"
echo -e "${GREEN}  → http://localhost:${FRONTEND_PORT}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "  Open in browser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "http://localhost:${FRONTEND_PORT}"
fi

echo ""
echo "  To stop: docker compose down"
echo "  To view logs: docker compose logs -f"
echo ""
