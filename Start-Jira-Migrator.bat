@echo off
TITLE Jira Migrator Launcher
cd /d "%~dp0"

echo Zamykanie istniejacych procesow...
taskkill /F /IM "node.exe" /T >nul 2>&1

echo Uruchamianie serwer... prosze czekac.
start /B pnpm run dev >nul 2>&1

:loop
curl -s http://localhost:5173 >nul
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto loop
)

echo Otwieranie aplikacji...
set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "%CHROME_PATH%" (
    "%CHROME_PATH%" --app=http://localhost:5173
) else (
    set "CHROME_PATH_X86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    if exist "%CHROME_PATH_X86%" (
        "%CHROME_PATH_X86%" --app=http://localhost:5173
    ) else (
        echo Nie znaleziono Chrome. Otwieranie w domyslnej przegladarce...
        start /WAIT http://localhost:5173
    )
)

echo Zamykanie serwera...
taskkill /F /IM "node.exe" /T >nul 2>&1
exit
