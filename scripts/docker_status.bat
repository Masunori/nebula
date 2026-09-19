@echo off
REM scripts/docker_status.bat - Check NebulaX Docker stack status
echo =================================================================
echo             NEBULAX DOCKER STACK HEALTH & STATUS                 
echo =================================================================
cd /d "%~dp0\.."

docker compose -f compose.local.yaml ps

echo.
echo =================================================================
echo Checking service connectivity...
echo -----------------------------------------------------------------
curl -s -o nul -w "  Client UI:        %%{http_code} (http://localhost:3000)\n" http://localhost:3000
curl -s -o nul -w "  FastAPI Engine:   %%{http_code} (http://localhost:8000/health)\n" http://localhost:8000/health
echo -----------------------------------------------------------------
echo.
pause
