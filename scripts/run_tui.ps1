# scripts/run_tui.ps1 - Launch NebulaX Terminal User Interface (TUI)
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "            NEBULAX TERMINAL USER INTERFACE (TUI)                " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..\database")

$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nebuladb"

python scripts\nebula_tui.py $args
