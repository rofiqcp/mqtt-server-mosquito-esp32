#!/bin/bash
###############################################################################
# ESP32 PlatformIO Setup Script
# Automatically install Python, PlatformIO, and prepare for ESP32 upload
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ESP32 PlatformIO Setup${NC}"
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
if [ "$EUID" -eq 0 ]; then 
    print_warning "Running as root. PlatformIO should be installed as regular user."
    print_warning "Consider running without sudo"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARDWARE_DIR="$SCRIPT_DIR/hardware"

print_info "Script directory: $SCRIPT_DIR"
print_info "Hardware directory: $HARDWARE_DIR"

# Step 1: Check Python installation
print_info "Checking Python installation..."

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    print_success "Python3 found: $PYTHON_VERSION"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
    print_success "Python found: $PYTHON_VERSION"
    PYTHON_CMD="python"
else
    print_warning "Python not found. Installing Python3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
    PYTHON_CMD="python3"
    print_success "Python3 installed"
fi

# Verify Python version (PlatformIO requires 3.6+)
PYTHON_MAJOR=$($PYTHON_CMD -c 'import sys; print(sys.version_info.major)')
PYTHON_MINOR=$($PYTHON_CMD -c 'import sys; print(sys.version_info.minor)')

print_info "Python version: $PYTHON_MAJOR.$PYTHON_MINOR"

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 6 ]); then
    print_error "Python 3.6+ is required. Current version: $PYTHON_MAJOR.$PYTHON_MINOR"
    exit 1
fi

# Step 2: Check pip installation
print_info "Checking pip installation..."

if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    print_warning "pip not found. Installing pip..."
    sudo apt-get install -y python3-pip
    print_success "pip installed"
fi

PIP_CMD=$(command -v pip3 || command -v pip)
print_success "pip found: $PIP_CMD"

# Step 3: Install system dependencies
print_info "Installing system dependencies..."

sudo apt-get update
sudo apt-get install -y \
    git \
    curl \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-dev \
    udev \
    libusb-1.0-0-dev

print_success "System dependencies installed"

# Step 4: Install PlatformIO Core
print_info "Checking PlatformIO installation..."

if command -v pio &> /dev/null; then
    PIO_VERSION=$(pio --version 2>&1 | head -n1)
    print_success "PlatformIO already installed: $PIO_VERSION"
else
    print_info "Installing PlatformIO Core..."
    $PIP_CMD install --user -U platformio
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
        print_info "Added PlatformIO to PATH"
    fi
    
    print_success "PlatformIO installed successfully"
fi

# Verify PlatformIO installation
if ! command -v pio &> /dev/null; then
    print_error "PlatformIO installation failed or not in PATH"
    print_info "Try running: export PATH=\"\$HOME/.local/bin:\$PATH\""
    exit 1
fi

# Step 5: Setup udev rules for ESP32 (Linux only)
if [ -f /etc/udev/rules.d/99-platformio-udev.rules ]; then
    print_success "udev rules already configured"
else
    print_info "Setting up udev rules for ESP32..."
    curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core/master/scripts/99-platformio-udev.rules | sudo tee /etc/udev/rules.d/99-platformio-udev.rules
    sudo udevadm control --reload-rules
    sudo udevadm trigger
    print_success "udev rules configured"
    print_warning "You may need to replug your ESP32 device"
fi

# Step 6: Add user to dialout group (for serial access)
print_info "Checking serial port permissions..."

if groups | grep -q "dialout"; then
    print_success "User already in dialout group"
else
    print_info "Adding user to dialout group..."
    sudo usermod -a -G dialout $USER
    print_warning "You need to log out and log back in for group changes to take effect"
fi

# Step 7: Navigate to hardware directory
if [ ! -d "$HARDWARE_DIR" ]; then
    print_error "Hardware directory not found: $HARDWARE_DIR"
    exit 1
fi

cd "$HARDWARE_DIR"
print_success "Changed to hardware directory"

# Step 8: Verify platformio.ini exists
if [ ! -f "platformio.ini" ]; then
    print_error "platformio.ini not found in hardware directory"
    exit 1
fi

print_success "platformio.ini found"

# Step 9: Install ESP32 platform and libraries
print_info "Installing ESP32 platform and libraries..."
pio pkg install
print_success "Dependencies installed"

# Step 10: Check for connected ESP32 devices
print_info "Scanning for connected ESP32 devices..."

if command -v pio &> /dev/null; then
    DEVICES=$(pio device list 2>/dev/null || echo "")
    
    if [ -z "$DEVICES" ]; then
        print_warning "No ESP32 devices detected"
        print_info "Please connect your ESP32 device via USB"
    else
        print_success "Device(s) found:"
        echo "$DEVICES"
    fi
fi

# Step 11: Configuration files check
print_info "Checking configuration files..."

CONFIG_FILES=("include/config_wifi.h" "include/config_mqtt.h")
MISSING_FILES=()

for file in "${CONFIG_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    print_success "All configuration files present"
else
    print_warning "Missing configuration files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    print_info "Please create these files before uploading to ESP32"
fi

# Step 12: Build test
print_info "Testing build process..."

if pio run -e esp32dev; then
    print_success "Build test successful!"
else
    print_warning "Build test had issues, please check configuration"
fi

# Final summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Hardware Directory:${NC} $HARDWARE_DIR"
echo -e "${BLUE}Python Version:${NC} $($PYTHON_CMD --version 2>&1)"
echo -e "${BLUE}PlatformIO Version:${NC} $(pio --version 2>&1 | head -n1)"

echo -e "\n${YELLOW}Available PlatformIO Commands:${NC}"
echo -e "  ${GREEN}pio run${NC}              - Build firmware"
echo -e "  ${GREEN}pio run -t upload${NC}    - Upload to ESP32"
echo -e "  ${GREEN}pio run -t monitor${NC}   - Open serial monitor"
echo -e "  ${GREEN}pio device list${NC}      - List connected devices"
echo -e "  ${GREEN}pio run -t clean${NC}     - Clean build files"

echo -e "\n${YELLOW}Quick Upload to ESP32:${NC}"
echo -e "  cd $HARDWARE_DIR"
echo -e "  pio run -t upload"

echo -e "\n${YELLOW}Monitor Serial Output:${NC}"
echo -e "  pio device monitor"

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "\n${RED}⚠ WARNING: Configure these files before upload:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo -e "  - ${YELLOW}$file${NC}"
    done
fi

if ! groups | grep -q "dialout"; then
    echo -e "\n${YELLOW}⚠ NOTE: Log out and log in again to apply serial port permissions${NC}"
fi

echo -e "\n${GREEN}✓ ESP32 PlatformIO setup completed successfully!${NC}\n"
