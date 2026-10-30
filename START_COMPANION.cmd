@echo off
setlocal
cd /d "%~dp0"
rem Configure an independently provisioned runtime; never restore/use a Codex cache implicitly.
if not defined MW5_COMPANION_RUNTIME_ROOT (
  echo Set MW5_COMPANION_RUNTIME_ROOT to the reviewed writable runtime installation.
  exit /b 1
)
if defined MW5_COMPANION_NODE (
  set "MW5_LAUNCH_NODE=%MW5_COMPANION_NODE%"
) else (
  set "MW5_LAUNCH_NODE=%MW5_COMPANION_RUNTIME_ROOT%\node\node.exe"
)
if not exist "%MW5_LAUNCH_NODE%" (
  if defined MW5_COMPANION_NODE (
    echo The configured MW5_COMPANION_NODE executable was not found.
    exit /b 1
  )
  echo The configured runtime has no Node executable. Provision it before launching.
  exit /b 1
)
"%MW5_LAUNCH_NODE%" -e "if (Number(process.versions.node.split('.')[0]) !== 24) process.exit(1)" >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 is required. Set MW5_COMPANION_NODE to its full executable path.
  echo This launcher does not install software.
  if /i not "%~1"=="--check" pause
  exit /b 1
)
if /i "%~1"=="--check" (
  echo Runtime check passed: %MW5_LAUNCH_NODE%
  "%MW5_LAUNCH_NODE%" --version
  exit /b 0
)
"%MW5_LAUNCH_NODE%" companion\server.mjs --open
if errorlevel 1 pause
