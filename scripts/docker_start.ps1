# scripts/docker_start.ps1 - Cleanly start NebulaX Docker stack
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "            NEBULAX DOCKER STACK LAUNCHER                        " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..")

Write-Host "[*] Starting containers in background..." -ForegroundColor Cyan
docker compose -f compose.local.yaml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start Docker compose stack." -ForegroundColor Red
    Write-Host "Please ensure Docker Desktop is running." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[+] Containers started successfully!" -ForegroundColor Green
Write-Host "-----------------------------------------------------------------"
Write-Host "  Web Client (UI):        http://localhost:3000" -ForegroundColor White
Write-Host "  Schedule Optimizer:     http://localhost:3000/schedule" -ForegroundColor White
Write-Host "  Database Studio:        http://localhost:3000/database" -ForegroundColor White
Write-Host "  FastAPI Engine (API):   http://localhost:8000" -ForegroundColor White
Write-Host "  Interactive API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  PostgreSQL Database:    localhost:5432 (nebuladb / postgres)" -ForegroundColor White
Write-Host "-----------------------------------------------------------------"
Write-Host ""
docker compose -f compose.local.yaml ps
