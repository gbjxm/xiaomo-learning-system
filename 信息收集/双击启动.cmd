@echo off
chcp 65001 >nul
cd /d "%~dp0"
python app.py serve --open
if errorlevel 1 pause
