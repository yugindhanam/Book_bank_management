@echo off
setlocal
title LICET Book Bank
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-all.ps1" %*
if errorlevel 1 (
  echo.
  echo Startup failed. Please read the message above.
  pause
  exit /b 1
)
endlocal
