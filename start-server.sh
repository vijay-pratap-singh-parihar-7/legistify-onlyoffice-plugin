#!/bin/bash
# Start Local Server for OnlyOffice Plugin Development

echo "🚀 Starting local server for OnlyOffice plugin..."
echo ""

# Check if http-server is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not installed. Please install Node.js first."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Current directory: $SCRIPT_DIR"
echo "🌐 Starting server on http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start http-server with CORS enabled
npx http-server -p 8080 --cors
