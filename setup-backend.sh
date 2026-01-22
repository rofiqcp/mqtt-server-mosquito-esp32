#!/bin/bash
###############################################################################
# MQTT Server Backend Setup Script
# Automatically install Node.js 18, dependencies, and test the backend
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MQTT Server Backend Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_warning "This script may require sudo privileges for some operations"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

print_info "Script directory: $SCRIPT_DIR"
print_info "Server directory: $SERVER_DIR"

# Step 1: Check and Install Node.js 18
print_info "Checking Node.js installation..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    print_info "Node.js version: $(node --version)"
    
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js version is less than 18. Upgrading..."
        INSTALL_NODE=true
    else
        print_success "Node.js 18+ is already installed"
        INSTALL_NODE=false
    fi
else
    print_warning "Node.js not found. Installing Node.js 18..."
    INSTALL_NODE=true
fi

if [ "$INSTALL_NODE" = true ]; then
    print_info "Installing Node.js 18..."
    
    # Install Node.js 18
    if command -v curl &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        print_success "Node.js 18 installed successfully"
    else
        print_error "curl not found. Please install curl first: sudo apt-get install curl"
        exit 1
    fi
fi

# Verify npm
if ! command -v npm &> /dev/null; then
    print_error "npm not found after Node.js installation"
    exit 1
fi

print_info "npm version: $(npm --version)"

# Step 2: Navigate to server directory
if [ ! -d "$SERVER_DIR" ]; then
    print_error "Server directory not found: $SERVER_DIR"
    exit 1
fi

cd "$SERVER_DIR"
print_success "Changed to server directory"

# Step 3: Install dependencies
print_info "Installing npm dependencies..."
npm install
print_success "Dependencies installed successfully"

# Step 4: Check .env file
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cat > .env << 'EOF'
# Server Configuration
PORT=3000
MQTT_PORT=1883
MQTT_WS_PORT=8083

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Database
DB_PATH=./data/mqtt.db

# Security
ALLOW_ANONYMOUS=true
EOF
    print_success ".env file created"
else
    print_success ".env file already exists"
fi

# Step 5: Create data directory
print_info "Creating data directory..."
mkdir -p data
print_success "Data directory ready"

# Step 6: Run tests if test file exists
if [ -f "server.test.js" ]; then
    print_info "Running backend tests..."
    if npm test; then
        print_success "All tests passed!"
    else
        print_warning "Some tests failed, but continuing..."
    fi
else
    print_warning "No test file found (server.test.js)"
fi

# Step 7: Quick connectivity test
print_info "Testing server startup..."
timeout 5s npm start > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    print_success "Server started successfully!"
    kill $SERVER_PID 2>/dev/null || true
else
    print_warning "Could not verify server startup"
fi

# Final summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Server Directory:${NC} $SERVER_DIR"
echo -e "${BLUE}Node.js Version:${NC} $(node --version)"
echo -e "${BLUE}npm Version:${NC} $(npm --version)"

echo -e "\n${YELLOW}To start the server:${NC}"
echo -e "  cd $SERVER_DIR"
echo -e "  npm start"

echo -e "\n${YELLOW}Server will be available at:${NC}"
echo -e "  Dashboard: http://localhost:3000"
echo -e "  MQTT Broker: mqtt://localhost:1883"
echo -e "  WebSocket: ws://localhost:3000/ws"

echo -e "\n${YELLOW}Default Login:${NC}"
echo -e "  Username: admin"
echo -e "  Password: admin123"

echo -e "\n${GREEN}✓ Backend setup completed successfully!${NC}\n"
