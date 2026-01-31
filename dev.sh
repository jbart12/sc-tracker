#!/bin/bash

# SC Tracker - Local Development Script
# Starts both the API server and Vite dev server

cd "$(dirname "$0")"

# Start the API server in the background
DATA_FILE="$(pwd)/data/sc-tracker-data.json" node server/index.js &
API_PID=$!

# Start the Vite dev server
npm run dev &
VITE_PID=$!

# Handle Ctrl+C to kill both processes
trap "kill $API_PID $VITE_PID 2>/dev/null; exit" INT TERM

echo ""
echo "Started API server (PID: $API_PID) on port 3001"
echo "Started Vite dev server (PID: $VITE_PID) on port 5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for either process to exit
wait
