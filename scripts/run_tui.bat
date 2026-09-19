@echo off
REM scripts/run_tui.bat - Launch NebulaX Terminal User Interface (TUI)
echo =================================================================
echo             NEBULAX TERMINAL USER INTERFACE (TUI)                
echo =================================================================
cd /d "%~dp0\..\database"

REM Set DATABASE_URL to host PostgreSQL instance running on Docker
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nebuladb

python scripts\nebula_tui.py %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTE] Python environment or rich library missing. Attempting pip install rich...
    pip install rich
    python scripts\nebula_tui.py %*
)
pause
