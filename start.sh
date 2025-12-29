#!/bin/bash

# SC Tracker - Startup Script
# Usage: ./start.sh [port]
# Example: ./start.sh 3001

set -e

PORT="${1:-3000}"
CONTAINER_NAME="sc-tracker"

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

# Stop existing container if running
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    echo -e "${YELLOW}Stopping existing container...${NC}"
    docker stop "$CONTAINER_NAME" > /dev/null
    sleep 1
fi

# Remove existing container if exists
if docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
    echo -e "${YELLOW}Removing existing container...${NC}"
    docker rm "$CONTAINER_NAME" > /dev/null
fi

# Check if port is in use (only LISTEN state)
if lsof -i :"$PORT" -sTCP:LISTEN > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port $PORT is already in use.${NC}"
    echo "Checking what's using it..."
    lsof -i :"$PORT" -sTCP:LISTEN
    echo ""
    echo -e "Try a different port: ${GREEN}./start.sh 3001${NC}"
    exit 1
fi

# Build and start
echo -e "${GREEN}Building and starting SC Tracker on port $PORT...${NC}"
PORT="$PORT" docker compose up --build -d

echo ""
echo -e "${GREEN}SC Tracker is running!${NC}"
echo -e "Open in browser: ${GREEN}http://localhost:$PORT${NC}"
echo ""
echo "Commands:"
echo "  Stop:    docker stop $CONTAINER_NAME"
echo "  Logs:    docker logs $CONTAINER_NAME"
echo "  Restart: ./start.sh $PORT"
