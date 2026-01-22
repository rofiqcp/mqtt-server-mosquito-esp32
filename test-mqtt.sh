#!/bin/bash

# ============================================
# MQTT Client Test Script
# ============================================

echo "🧪 MQTT Client Test"
echo "==================="

# Configuration
MQTT_HOST="${1:-localhost}"
MQTT_PORT="${2:-1883}"
API_KEY="${3:-admin}"

echo "Server: $MQTT_HOST:$MQTT_PORT"
echo "API Key: $API_KEY"
echo ""

# Check if mosquitto_pub is installed
if ! command -v mosquitto_pub &> /dev/null; then
    echo "⚠️  mosquitto-clients not found. Installing..."
    apt-get update && apt-get install -y mosquitto-clients
fi

# Test connection
echo "📡 Testing connection..."
mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -u "$API_KEY" -t "test/connection" -m "test" -q 1

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
else
    echo "❌ Connection failed!"
    exit 1
fi

# Publish test sensor data
echo ""
echo "📤 Publishing test sensor data..."

for i in {1..5}; do
    TEMP=$(echo "scale=2; 20 + $RANDOM % 15" | bc)
    HUM=$(echo "scale=2; 40 + $RANDOM % 40" | bc)
    
    DATA="{\"device\":\"test_client\",\"temperature\":$TEMP,\"humidity\":$HUM,\"timestamp\":$(date +%s)}"
    
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -u "$API_KEY" \
        -t "home/sensor/data" -m "$DATA" -q 1
    
    echo "  [$i] Temp: ${TEMP}°C, Humidity: ${HUM}%"
    sleep 1
done

echo ""
echo "✅ Test completed!"
echo ""
echo "📊 Check dashboard: http://$MQTT_HOST:3000"
