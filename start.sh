#!/bin/bash

# SC Tracker - Start both API server and Vite dev server
# Usage: ./start.sh

cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Kill any existing instances
pkill -f "node server/index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Ensure data directory exists
mkdir -p data

# Install server dependencies if needed
if [ ! -d server/node_modules ]; then
  echo "Installing server dependencies..."
  (cd server && npm install)
fi

# Start API server
DATA_FILE="$(pwd)/data/sc-tracker-data.json" node server/index.js &
API_PID=$!
sleep 1

# Verify API server started
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}API server running${NC} (PID: $API_PID) on port 3001"
else
  echo -e "${RED}API server failed to start${NC}"
  exit 1
fi

# Start Vite dev server
npm run dev &
VITE_PID=$!

trap "echo ''; echo 'Shutting down...'; kill $API_PID $VITE_PID 2>/dev/null; exit" INT TERM

echo ""
echo -e "${GREEN}SC Tracker is running!${NC}"
echo "  App:  http://localhost:5173"
echo "  API:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"

wait
