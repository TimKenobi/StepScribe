# ─────────────────────────────────────────────────────────────────
# StepScribe — Windows Install & Launch Script (PowerShell)
# Checks for Docker, optionally installs Ollama, starts services.
# Run: powershell -ExecutionPolicy Bypass -File install-windows.ps1
# ─────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  StepScribe — Recovery Journaling Companion" -ForegroundColor Yellow
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# ── Find project root (script is in \scripts\) ──
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# ── Check Docker ──
Write-Host "Checking Docker..." -ForegroundColor White
$dockerAvailable = $false
try {
    $null = docker info 2>&1
    $dockerAvailable = $true
    Write-Host "  [OK] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  [X] Docker is not running or not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Docker Desktop is required to run StepScribe."
    Write-Host "  Download it from: https://www.docker.com/products/docker-desktop/"
    Write-Host ""
    $openDocker = Read-Host "  Open Docker download page? (y/n)"
    if ($openDocker -eq "y") {
        Start-Process "https://www.docker.com/products/docker-desktop/"
    }
    Write-Host ""
    Write-Host "  After installing Docker, run this script again." -ForegroundColor Yellow
    exit 1
}

# ── Check Docker Compose ──
try {
    $null = docker compose version 2>&1
    Write-Host "  [OK] Docker Compose available" -ForegroundColor Green
} catch {
    Write-Host "  [X] Docker Compose not found" -ForegroundColor Red
    Write-Host "  Please update Docker Desktop to include Docker Compose v2."
    exit 1
}

# ── Optional: Install Ollama ──
Write-Host ""
Write-Host "Local AI (Ollama) — Optional" -ForegroundColor White
Write-Host "  Ollama lets you run AI models locally on your PC."
Write-Host "  This is 100% private — nothing leaves your computer."
Write-Host ""

$ollamaInstalled = $false
try {
    $null = Get-Command ollama -ErrorAction Stop
    $ollamaInstalled = $true
    Write-Host "  [OK] Ollama is already installed" -ForegroundColor Green
} catch {
    $installOllama = Read-Host "  Install Ollama for local AI? (y/n)"
    if ($installOllama -eq "y") {
        Write-Host ""
        Write-Host "  Downloading Ollama installer..."
        $installerPath = Join-Path $env:TEMP "OllamaSetup.exe"
        try {
            Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installerPath -UseBasicParsing
            Write-Host "  Running Ollama installer..."
            Start-Process -FilePath $installerPath -Wait
            $ollamaInstalled = $true
            Write-Host "  [OK] Ollama installed" -ForegroundColor Green
        } catch {
            Write-Host "  [!] Could not download Ollama. Install manually: https://ollama.com/download" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  -> Skipping Ollama (you can set up a cloud API in the app)" -ForegroundColor Yellow
    }
}

# ── Start Ollama if installed ──
if ($ollamaInstalled) {
    $ollamaRunning = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
    if (-not $ollamaRunning) {
        Write-Host ""
        Write-Host "  Starting Ollama service..."
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        Write-Host "  [OK] Ollama service started" -ForegroundColor Green
    }
}

# ── Create .env if missing ──
Write-Host ""
Write-Host "Checking configuration..." -ForegroundColor White
$envPath = Join-Path $ProjectRoot ".env"
$envExamplePath = Join-Path $ProjectRoot ".env.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-Host "  [OK] Created .env from .env.example" -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] .env file exists" -ForegroundColor Green
}

# ── Build and start ──
Write-Host ""
Write-Host "Starting StepScribe..." -ForegroundColor White

Push-Location $ProjectRoot
try {
    Write-Host "  Building containers (this may take a few minutes on first run)..."
    docker compose up --build -d

    Write-Host ""
    Write-Host "  Waiting for services to be ready..."
    $maxWait = 120
    $waited = 0
    while ($waited -lt $maxWait) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8100/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -lt 500) { break }
        } catch { }
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "  ." -NoNewline
    }
    Write-Host ""

    if ($waited -ge $maxWait) {
        Write-Host "  [X] Services did not start in time. Run: docker compose logs" -ForegroundColor Red
        exit 1
    }

    Write-Host "  [OK] Backend is ready" -ForegroundColor Green
    Start-Sleep -Seconds 3
    Write-Host "  [OK] Frontend is ready" -ForegroundColor Green
} finally {
    Pop-Location
}

# ── Open in browser ──
$frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "3100" }
Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "    StepScribe is running!" -ForegroundColor Green
Write-Host "    -> http://localhost:$frontendPort" -ForegroundColor Green
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

$openBrowser = Read-Host "  Open in browser? (y/n)"
if ($openBrowser -eq "y") {
    Start-Process "http://localhost:$frontendPort"
}

Write-Host ""
Write-Host "  To stop: docker compose down"
Write-Host "  To view logs: docker compose logs -f"
Write-Host ""
