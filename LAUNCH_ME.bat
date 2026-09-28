@echo off
setlocal
cd /d "%~dp0"
title Workshop Registration API - Launcher

echo.
echo === Workshop Registration API - Launcher ===
echo.

echo [1/6] Checking Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20.17 or newer, then run this again.
  pause
  exit /b 1
)
node -v

echo.
echo [2/6] Installing dependencies
call npm install
if errorlevel 1 (
  echo npm install failed. Check your internet connection and try again.
  pause
  exit /b 1
)

echo.
echo [3/6] Jest suite - scenarios A-D
call npm test

echo.
echo [4/6] Starting the API on http://localhost:3030
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://localhost:3030/workshops -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Workshop Registration API" cmd /k npm run start
) else (
  echo The API is already running on port 3030.
)
powershell -NoProfile -Command "for ($i = 0; $i -lt 90; $i++) { try { Invoke-WebRequest -UseBasicParsing http://localhost:3030/workshops -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 (
  echo The API did not start. Check the "Workshop Registration API" window for errors.
  pause
  exit /b 1
)
echo API is up.

echo.
echo [5/6] Selenium demo - Chrome opens and runs 4 scenarios slowly
call npm run test:selenium:demo

echo.
echo [6/6] k6 load test - 60 seconds against GET /workshops
where k6 >nul 2>nul
if errorlevel 1 (
  echo k6 was not found on PATH - skipped. Install k6, then run: k6 run test-load.js
) else (
  k6 run test-load.js
)

echo.
echo === Done ===
echo The API keeps running in its own window. Close that window to stop it.
echo Metrics: http://localhost:3030/metrics
echo Catalog: http://localhost:3030/workshops
echo Prometheus and Grafana: see README.md
start "" http://localhost:3030/metrics
echo.
pause
