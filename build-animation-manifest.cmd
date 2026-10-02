@echo off
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\build-animation-manifest.ps1"
if errorlevel 1 (
  echo Animation manifest generation failed.
) else (
  echo Animation manifest generation finished.
)
popd
pause
