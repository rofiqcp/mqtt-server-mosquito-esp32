require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const aedes = require('aedes')();
const net = require('net');
const path = require('path');
const Database = require('./database');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const keyRoutes = require('./routes/keys');
const dataRoutes = require('./routes/data');
const topicRoutes = require('./routes/topics');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Database initialization
const db = new Database();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Make db available to routes
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/topics', topicRoutes);

// MQTT Broker
const mqttServer = net.createServer(aedes.handle);
const MQTT_PORT = process.env.MQTT_PORT || 1883;

mqttServer.listen(MQTT_PORT, '0.0.0.0', () => {
    console.log(`🚀 MQTT Broker running on port ${MQTT_PORT}`);
});

// WebSocket clients for real-time updates
const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('📱 WebSocket client connected');
    
    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('📴 WebSocket client disconnected');
    });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
    const message = JSON.stringify(data);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// MQTT Events
aedes.authenticate = (client, username, password, callback) => {
    // Allow anonymous for testing (set ALLOW_ANONYMOUS=true in .env)
    if (!username || process.env.ALLOW_ANONYMOUS === 'true') {
        callback(null, true);
        return;
    }
    
    const key = db.validateApiKey(username);
    if (key) {
        db.updateDeviceLastSeen(client.id);
        callback(null, true);
    } else if (username === 'admin' && password?.toString() === process.env.ADMIN_PASSWORD) {
        callback(null, true);
    } else {
        callback(new Error('Authentication failed'), false);
    }
};

aedes.on('client', (client) => {
    console.log(`✅ Client connected: ${client.id}`);
    db.logDeviceConnection(client.id, 'connected');
    broadcast({ type: 'device_connected', clientId: client.id, timestamp: new Date() });
});

aedes.on('clientDisconnect', (client) => {
    console.log(`❌ Client disconnected: ${client.id}`);
    db.logDeviceConnection(client.id, 'disconnected');
    broadcast({ type: 'device_disconnected', clientId: client.id, timestamp: new Date() });
});

aedes.on('publish', (packet, client) => {
    if (client && !packet.topic.startsWith('$')) {
        const payload = packet.payload.toString();
        console.log(`📨 Message: ${packet.topic} -> ${payload}`);
        
        // Store data
        db.storeData(client.id, packet.topic, payload);
        
        // Broadcast to dashboard
        broadcast({
            type: 'message',
            clientId: client.id,
            topic: packet.topic,
            payload: payload,
            timestamp: new Date()
        });
    }
});

aedes.on('subscribe', (subscriptions, client) => {
    console.log(`📥 Subscribe: ${client.id} -> ${subscriptions.map(s => s.topic).join(', ')}`);
});

// API endpoint to publish message
app.post('/api/publish', (req, res) => {
    const { topic, message, retain = false, qos = 0 } = req.body;
    
    aedes.publish({
        topic: topic,
        payload: Buffer.from(message),
        qos: qos,
        retain: retain
    }, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, message: 'Published successfully' });
        }
    });
});

// Get connected clients
app.get('/api/clients', (req, res) => {
    const clients = [];
    aedes.clients.forEach((client, id) => {
        clients.push({ id: id, connected: true });
    });
    res.json(clients);
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
    const stats = db.getStats();
    stats.connectedClients = aedes.clients.size;
    res.json(stats);
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
    console.log(`🌐 Dashboard API running on http://${HOST}:${PORT}`);
    console.log(`📊 MQTT Broker on port ${MQTT_PORT}`);
    console.log(`🔌 WebSocket on ws://${HOST}:${PORT}/ws`);
    console.log(`🌍 Public access: http://165.232.171.115:${PORT}`);
});

module.exports = { app, aedes, db };
