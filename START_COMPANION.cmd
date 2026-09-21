@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. This launcher does not install software.
  pause
  exit /b 1
)
node companion\server.mjs --open
if errorlevel 1 pause
