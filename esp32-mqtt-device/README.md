# ESP32 MQTT IoT Device

Proyek PlatformIO untuk ESP32 yang terhubung ke MQTT Dashboard Pro.

## Fitur

- ✅ Koneksi WiFi dengan auto-reconnect
- ✅ MQTT client dengan authentikasi API Key
- ✅ Multi-sensor (DHT22, Analog, PIR Motion)
- ✅ JSON payload format
- ✅ Deep sleep mode untuk hemat energi
- ✅ OTA update support
- ✅ LED status indicator
- ✅ Button control
- ✅ Watchdog timer
- ✅ Last Will Testament (LWT)

## Hardware Requirements

- ESP32 Development Board
- DHT22 Temperature/Humidity Sensor
- PIR Motion Sensor (optional)
- LED indicators (optional)
- Relay module (optional)

## Wiring Diagram

```
ESP32 Pin    | Component
-------------|------------------
GPIO 2       | Built-in LED
GPIO 4       | WiFi Status LED
GPIO 5       | MQTT Status LED
GPIO 15      | DHT22 Data Pin
GPIO 17      | PIR Sensor
GPIO 34      | Analog Input
GPIO 16      | Relay Module
GPIO 0       | Boot Button
```

## Configuration

Edit file `src/main.cpp`:

```cpp
// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// MQTT Broker Configuration
#define MQTT_SERVER "192.168.1.100"  // IP Server Dashboard
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "esp32_device_001"

// API Key dari Dashboard
#define MQTT_API_KEY "mqtt_your_api_key_here"
```

## Build & Upload

### Via PlatformIO CLI

```bash
# Build
pio run

# Upload
pio run --target upload

# Monitor Serial
pio device monitor

# Build + Upload + Monitor
pio run --target upload && pio device monitor
```

### Via VS Code

1. Buka folder project di VS Code
2. Install extension PlatformIO IDE
3. Klik icon PlatformIO di sidebar
4. Pilih "Build" untuk compile
5. Pilih "Upload" untuk flash ke ESP32
6. Pilih "Monitor" untuk melihat serial output

## Debug

```bash
# Debug build
pio run -e esp32dev_debug

# Start debugger
pio debug
```

## MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `home/sensor/data` | ESP32 → Server | Data sensor (temperature, humidity, etc) |
| `home/sensor/status` | ESP32 → Server | Device status (online, offline, etc) |
| `home/sensor/command` | Server → ESP32 | Commands (relay on/off, restart, etc) |
| `home/sensor/config` | Server → ESP32 | Configuration updates |

## JSON Payload Examples

### Sensor Data (published)
```json
{
  "device": "esp32_device_001",
  "uptime": 3600,
  "messages": 720,
  "sensors": {
    "temperature": 25.50,
    "humidity": 60.00,
    "analog": 2048,
    "voltage": 1.65,
    "motion": false
  },
  "status": {
    "relay": false,
    "rssi": -45,
    "heap": 250000
  }
}
```

### Commands (subscribe)
```json
// Turn relay ON
{"relay": true}

// Turn relay OFF
{"relay": false}

// Restart device
{"restart": true}

// Deep sleep for 60 seconds
{"sleep": 60}

// Toggle debug mode
{"debug": true}

// Turn LED ON
{"led": true}
```

## Troubleshooting

### WiFi tidak terkoneksi
- Periksa SSID dan password
- Pastikan router dalam jangkauan
- Coba restart ESP32

### MQTT tidak terkoneksi
- Periksa IP server dan port
- Pastikan API Key valid dan aktif
- Cek firewall pada server

### Sensor tidak terbaca
- Periksa wiring DHT22
- Pastikan pin konfigurasi benar
- DHT22 butuh pull-up resistor 10K

### MQTT Error Codes
- `-4`: Connection timeout
- `-3`: Connection lost
- `-2`: Connect failed
- `-1`: Disconnected
- `4`: Bad credentials (API Key salah)
- `5`: Not authorized

## License

MIT License
