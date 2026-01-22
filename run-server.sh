#!/bin/bash
###############################################################################
# Quick Start - Run Backend Server
# Wrapper script untuk menjalankan server dengan mudah
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting MQTT Server...${NC}\n"

# Check if dependencies are installed
if [ ! -d "$SERVER_DIR/node_modules" ]; then
    echo -e "${YELLOW}Dependencies not found. Running setup first...${NC}\n"
    $SCRIPT_DIR/setup-backend.sh
    echo ""
fi

# Navigate to server directory
cd "$SERVER_DIR"

# Start server
echo -e "${GREEN}Server is starting...${NC}\n"
npm start

