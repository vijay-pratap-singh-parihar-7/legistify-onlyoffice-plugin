@echo off
REM Start Local Server for OnlyOffice Plugin Development (Windows)

echo.
echo 🚀 Starting local server for OnlyOffice plugin...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Get the directory where this script is located
cd /d "%~dp0"

echo 📁 Current directory: %CD%
echo 🌐 Starting server on http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start http-server with CORS enabled
npx http-server -p 8080 --cors

pause
