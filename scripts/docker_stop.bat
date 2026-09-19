@echo off
REM scripts/docker_stop.bat - Cleanly stop NebulaX Docker stack
echo =================================================================
echo             NEBULAX DOCKER STACK TERMINATOR                      
echo =================================================================
cd /d "%~dp0\.."

echo [*] Stopping and terminating containers...
docker compose -f compose.local.yaml down

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] 'docker compose down' reported an error, attempting forced stop...
    docker compose -f compose.local.yaml stop
)

echo.
echo [+] All NebulaX Docker containers stopped cleanly.
echo.
docker compose -f compose.local.yaml ps
echo.
pause
