#!/bin/bash

# ============================================
# MQTT Dashboard - Start Script
# ============================================

echo "🚀 Starting MQTT Dashboard..."
echo "================================"

# Change to backend directory
cd "$(dirname "$0")/backend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create data directory
mkdir -p data

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating default..."
    cat > .env << EOL
PORT=3000
MQTT_PORT=1883
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
DB_PATH=./data/mqtt_dashboard.db
EOL
fi

echo ""
echo "📊 Dashboard:  http://localhost:3000"
echo "🔌 MQTT Port:  1883"
echo "👤 Username:   admin"
echo "🔑 Password:   admin123"
echo ""
echo "================================"
echo ""

# Start server
npm start
