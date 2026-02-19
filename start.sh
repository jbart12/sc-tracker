#!/bin/bash

# SC Tracker - Start both API server and Vite dev server (detached)
# Usage: ./start.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$DIR/logs"
mkdir -p "$LOG_DIR" "$DIR/data"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Kill any existing instances on our ports
for port in 5173 3001; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Stopping existing process on port $port (PID: $pid)"
    kill $pid 2>/dev/null || true
    sleep 1
  fi
done

# Install server dependencies if needed
if [ ! -d "$DIR/server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd "$DIR/server" && npm install)
fi

cd "$DIR"

# Start API server (detached)
nohup node "$DIR/server/index.js" >> "$LOG_DIR/backend.log" 2>&1 &
API_PID=$!
sleep 1

# Verify API server started
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}API server running${NC} (PID: $API_PID) on port 3001"
else
  echo -e "${RED}API server failed to start${NC} — check logs/backend.log"
  exit 1
fi

# Start Vite dev server (detached)
nohup npm run dev >> "$LOG_DIR/vite.log" 2>&1 &
VITE_PID=$!
sleep 2

if lsof -i :5173 >/dev/null 2>&1; then
  echo -e "${GREEN}Vite running${NC} (PID: $VITE_PID) on port 5173"
else
  echo -e "${RED}Vite failed to start${NC} — check logs/vite.log"
  exit 1
fi

echo ""
echo -e "${GREEN}SC Tracker is running!${NC}"
echo "  App:  http://localhost:5173"
echo "  API:  http://localhost:3001"
echo ""
echo "Logs:   logs/vite.log, logs/backend.log"
echo "Crash:  logs/crash.log"
echo "Stop:   ./stop.sh"
