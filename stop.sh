#!/bin/bash
# Stop sc-tracker frontend and backend processes

for port in 5173 3001; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Stopping process on port $port (PID: $pid)"
    kill $pid 2>/dev/null || true
  else
    echo "Nothing running on port $port"
  fi
done
