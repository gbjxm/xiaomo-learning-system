@echo off
chcp 65001 >nul
cd /d "%~dp0"
python app.py update
echo.
echo 单次检查已结束，请查看上方各信源状态。
pause
