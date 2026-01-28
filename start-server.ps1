# Start Local Server for OnlyOffice Plugin Development (PowerShell)

Write-Host "🚀 Starting local server for OnlyOffice plugin..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $null = Get-Command node -ErrorAction Stop
} catch {
    Write-Host "❌ Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "📁 Current directory: $scriptDir" -ForegroundColor Cyan
Write-Host "🌐 Starting server on http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start http-server with CORS enabled
npx http-server -p 8080 --cors
