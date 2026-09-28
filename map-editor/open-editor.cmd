@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-tiles.ps1" -OpenEditor
if errorlevel 1 pause
