#!/bin/bash

# SC Tracker - Restart Script
# Kills existing processes and restarts both servers

cd "$(dirname "$0")"

echo "Stopping existing processes..."
pkill -f "node server/index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

echo "Starting API server..."
DATA_FILE="$(pwd)/data/sc-tracker-data.json" node server/index.js &
API_PID=$!
sleep 1

# Verify API server started
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "API server running (PID: $API_PID) on port 3001"
else
  echo "ERROR: API server failed to start"
  exit 1
fi

echo "Starting Vite dev server..."
npm run dev &
VITE_PID=$!

# Handle Ctrl+C to kill both processes
trap "echo ''; echo 'Shutting down...'; kill $API_PID $VITE_PID 2>/dev/null; exit" INT TERM

echo ""
echo "================================"
echo "SC Tracker is running!"
echo "  Frontend: http://localhost:5173"
echo "  API:      http://localhost:3001"
echo "================================"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for either process to exit
wait
