@echo off
REM scripts/docker_start.bat - Cleanly start NebulaX Docker stack
echo =================================================================
echo             NEBULAX DOCKER STACK LAUNCHER                        
echo =================================================================
cd /d "%~dp0\.."

echo [*] Starting containers in background...
docker compose -f compose.local.yaml up -d

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Docker compose stack.
    echo Please make sure Docker Desktop is running.
    pause
    exit /b 1
)

echo.
echo [+] Containers started successfully!
echo -----------------------------------------------------------------
echo   Web Client (UI):        http://localhost:3000
echo   Schedule Optimizer:     http://localhost:3000/schedule
echo   Database Studio:        http://localhost:3000/database
echo   FastAPI Engine (API):   http://localhost:8000
echo   Interactive API Docs:   http://localhost:8000/docs
echo   PostgreSQL Database:    localhost:5432 (nebuladb / postgres)
echo -----------------------------------------------------------------
echo.
docker compose -f compose.local.yaml ps
echo.
echo Press any key to exit this window...
pause >nul
