#!/bin/bash

# SC Tracker - Startup Script
# Usage: ./start.sh [port]
# Example: ./start.sh 3001

set -e

PORT="${1:-3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}SC Tracker - Startup Script${NC}"
echo "================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Stop and remove existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker compose down > /dev/null 2>&1 || true

# Check if port is in use (only LISTEN state)
if lsof -i :"$PORT" -sTCP:LISTEN > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port $PORT is already in use.${NC}"
    echo "Checking what's using it..."
    lsof -i :"$PORT" -sTCP:LISTEN
    echo ""
    echo -e "Try a different port: ${GREEN}./start.sh 3001${NC}"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p data

# Build and start
echo -e "${GREEN}Building and starting SC Tracker on port $PORT...${NC}"
PORT="$PORT" docker compose up --build -d

echo ""
echo -e "${GREEN}SC Tracker is running!${NC}"
echo -e "Open in browser: ${GREEN}http://localhost:$PORT${NC}"
echo -e "Data stored in: ${GREEN}./data/sc-tracker-data.json${NC}"
echo ""
echo "Commands:"
echo "  Stop:    docker compose down"
echo "  Logs:    docker compose logs -f"
echo "  Restart: ./start.sh $PORT"
