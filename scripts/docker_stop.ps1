# scripts/docker_stop.ps1 - Cleanly stop NebulaX Docker stack
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "            NEBULAX DOCKER STACK TERMINATOR                      " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..")

Write-Host "[*] Stopping and terminating containers..." -ForegroundColor Cyan
docker compose -f compose.local.yaml down

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] 'docker compose down' reported an error, attempting stop..." -ForegroundColor Yellow
    docker compose -f compose.local.yaml stop
}

Write-Host ""
Write-Host "[+] All NebulaX Docker containers stopped cleanly." -ForegroundColor Green
Write-Host ""
docker compose -f compose.local.yaml ps
