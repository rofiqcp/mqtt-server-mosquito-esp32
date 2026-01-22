# MQTT Dashboard Pro

Sistem MQTT lengkap dengan Dashboard canggih, manajemen device, API keys, grafik real-time, dan contoh program ESP32.

## 🚀 Quick Start (Automated Setup)

### Setup Backend (Auto-install Node.js 18 + Dependencies)
```bash
./setup-backend.sh
```

### Setup ESP32 Development (Auto-install Python + PlatformIO)
```bash
./setup-esp32.sh
```

### Run Server
```bash
./run-server.sh
# or
cd server && npm start
```

📖 **Detailed Guide**: See [SETUP_GUIDE.md](SETUP_GUIDE.md)

## 📁 Struktur Proyek

```
mqtt-server-mosquito-esp32/
├── server/                   # 🔴 Backend Server (Node.js)
│   ├── server.js            # Main server + MQTT Broker
│   ├── database.js          # SQLite database handler
│   ├── routes/              # API routes
│   │   ├── auth.js          # Authentication
│   │   ├── devices.js       # Device management
│   │   ├── keys.js          # API key management
│   │   ├── data.js          # Sensor data
│   │   └── topics.js        # Topic management
│   ├── public/              # Frontend Dashboard
│   │   ├── index.html       # Dashboard UI
│   │   └── app.js           # Frontend logic
│   └── package.json
│
├── hardware/                 # 🔵 ESP32 PlatformIO Project
│   ├── src/main.cpp         # Main ESP32 program
│   ├── include/             # Header files
│   ├── platformio.ini       # PlatformIO configuration
│   └── README.md            # ESP32 documentation
│
├── setup-backend.sh          # 🚀 Auto-setup backend script
├── setup-esp32.sh           # 🚀 Auto-setup ESP32 script
├── run-server.sh            # ▶️ Quick run server
└── SETUP_GUIDE.md           # 📖 Complete setup guide
```

## Fitur Dashboard

### 📊 Dashboard Utama
- Statistik real-time (devices, messages, keys)
- Grafik aktivitas
- Live message feed via WebSocket

### 🔧 Device Management
- Tambah/Edit/Hapus device
- Monitor status online/offline
- Last seen tracking
- Device configuration

### 🔑 API Key Management
- Generate API keys
- Enable/Disable keys
- Key expiration
- Usage tracking

### 📈 Analytics
- Grafik sensor data
- Filter by topic dan waktu
- Average, min, max values

### 📤 Publish Messages
- Send MQTT messages dari dashboard
- QoS dan Retain support

### 📋 Topics Management
- Define topic schemas
- Set data types dan units
- Value range validation

### 📜 Connection Logs
- Track device connections
- Connection history

## Quick Start

### 1. Start Backend Server

```bash
cd /root/mosquito
chmod +x start.sh
./start.sh
```

Server akan berjalan di:
- **Dashboard**: http://localhost:3000
- **MQTT Broker**: port 1883
- **WebSocket**: ws://localhost:3000/ws

### 2. Login ke Dashboard

- **Username**: admin
- **Password**: admin123

### 3. Generate API Key

1. Buka menu "API Keys"
2. Klik "Generate Key"
3. Copy key yang dihasilkan

### 4. Test dengan Simulator

```bash
cd /root/mosquito/simulator
pip install -r requirements.txt
python device_simulator.py --host localhost --devices 3
```

### 5. Test dengan Script

```bash
chmod +x test-mqtt.sh
./test-mqtt.sh localhost 1883 admin
```

## ESP32 Setup

### Requirements
- ESP32 Development Board
- PlatformIO IDE (VS Code extension)
- DHT22 Sensor (optional)

### Configure

Edit `esp32-mqtt-device/src/main.cpp`:

```cpp
#define WIFI_SSID "YOUR_WIFI"
#define WIFI_PASSWORD "YOUR_PASSWORD"
#define MQTT_SERVER "YOUR_SERVER_IP"
#define MQTT_API_KEY "mqtt_your_key_here"
```

### Build & Upload

```bash
cd /root/mosquito/esp32-mqtt-device

# Build
pio run

# Upload ke ESP32
pio run --target upload

# Monitor serial output
pio device monitor
```

## API Endpoints

### Authentication
```
POST /api/auth/login
POST /api/auth/register (admin only)
GET  /api/auth/me
```

### Devices
```
GET    /api/devices
GET    /api/devices/:id
POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id
GET    /api/devices/:id/data
```

### API Keys
```
GET    /api/keys
POST   /api/keys
PATCH  /api/keys/:id/toggle
DELETE /api/keys/:id
```

### Data
```
GET /api/data
GET /api/data/recent
GET /api/data/chart?topic=xxx&hours=24
GET /api/data/logs
```

### Publish
```
POST /api/publish
{
  "topic": "home/device/command",
  "message": "{\"relay\": true}",
  "qos": 1,
  "retain": false
}
```

### Stats
```
GET /api/stats
GET /api/clients
```

## MQTT Topics

### Sensor Data (device → server)
```
Topic: home/sensor/data
Payload: {
  "device": "esp32_001",
  "sensors": {
    "temperature": 25.5,
    "humidity": 60
  }
}
```

### Device Status (device → server)
```
Topic: home/sensor/status
Payload: {
  "device": "esp32_001",
  "status": "online",
  "ip": "192.168.1.50"
}
```

### Commands (server → device)
```
Topic: home/sensor/command
Payload: {
  "relay": true,
  "led": false,
  "restart": false
}
```

## WebSocket Events

Connect to `ws://localhost:3000/ws` untuk real-time updates:

```javascript
// Message received
{
  "type": "message",
  "clientId": "esp32_001",
  "topic": "home/sensor/data",
  "payload": "...",
  "timestamp": "..."
}

// Device connected
{
  "type": "device_connected",
  "clientId": "esp32_001"
}

// Device disconnected
{
  "type": "device_disconnected",
  "clientId": "esp32_001"
}
```

## Running Tests

```bash
cd /root/mosquito/backend
npm test
```

## Production Deployment

1. Set environment variables:
```bash
export PORT=3000
export MQTT_PORT=1883
export JWT_SECRET="your-secure-secret"
export ADMIN_PASSWORD="secure-password"
```

2. Use process manager:
```bash
npm install -g pm2
pm2 start server.js --name mqtt-dashboard
pm2 save
```

3. Setup reverse proxy (nginx):
```nginx
server {
    listen 80;
    server_name mqtt.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

## Troubleshooting

### Port sudah digunakan
```bash
lsof -i :3000
lsof -i :1883
kill -9 <PID>
```

### Database error
```bash
rm backend/data/mqtt_dashboard.db
# Restart server untuk recreate database
```

### ESP32 tidak konek
1. Check IP server
2. Pastikan port 1883 terbuka
3. Verify API key aktif

## License

MIT License

## Author

MQTT Dashboard Pro - IoT Platform
