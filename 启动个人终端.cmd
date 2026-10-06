@echo off
setlocal
set "TERMINAL_PWSH=pwsh.exe"
where pwsh.exe >nul 2>nul
if not errorlevel 1 goto launch
set "TERMINAL_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if exist "%TERMINAL_PWSH%" goto launch
echo PowerShell 7 was not found. Please open the project in PowerShell 7.
pause
exit /b 1
:launch
"%TERMINAL_PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0web\Open-PersonalTerminal.ps1"
if errorlevel 1 pause
