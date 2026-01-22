const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class MQTTDatabase {
    constructor() {
        const dbPath = process.env.DB_PATH || './data/mqtt_dashboard.db';
        const dbDir = path.dirname(dbPath);
        
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        this.db = new Database(dbPath);
        this.init();
    }

    init() {
        // Users table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Devices table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                client_id TEXT UNIQUE,
                type TEXT DEFAULT 'esp32',
                description TEXT,
                location TEXT,
                status TEXT DEFAULT 'offline',
                last_seen DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                config TEXT DEFAULT '{}'
            )
        `);

        // API Keys table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                device_id TEXT,
                permissions TEXT DEFAULT '["publish","subscribe"]',
                is_active INTEGER DEFAULT 1,
                expires_at DATETIME,
                last_used DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(id)
            )
        `);

        // Topics table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS topics (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                data_type TEXT DEFAULT 'string',
                unit TEXT,
                min_value REAL,
                max_value REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Data storage table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT,
                topic TEXT NOT NULL,
                payload TEXT NOT NULL,
                numeric_value REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Connection logs
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS connection_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT,
                event TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_sensor_data_device ON sensor_data(device_id);
            CREATE INDEX IF NOT EXISTS idx_sensor_data_topic ON sensor_data(topic);
            CREATE INDEX IF NOT EXISTS idx_sensor_data_created ON sensor_data(created_at);
        `);

        // Create default admin user
        this.createDefaultAdmin();
    }

    createDefaultAdmin() {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        const admin = stmt.get('admin');
        
        if (!admin) {
            const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
            const insert = this.db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
            insert.run(uuidv4(), 'admin', hashedPassword, 'admin');
            console.log('✅ Default admin user created');
        }
    }

    // User methods
    findUserByUsername(username) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    }

    createUser(username, password, role = 'user') {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const stmt = this.db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
        return stmt.run(uuidv4(), username, hashedPassword, role);
    }

    // Device methods
    getAllDevices() {
        const stmt = this.db.prepare('SELECT * FROM devices ORDER BY created_at DESC');
        return stmt.all();
    }

    getDevice(id) {
        const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
        return stmt.get(id);
    }

    createDevice(data) {
        const id = uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO devices (id, name, client_id, type, description, location, config)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, data.name, data.client_id, data.type || 'esp32', data.description, data.location, JSON.stringify(data.config || {}));
        return { id, ...data };
    }

    updateDevice(id, data) {
        const stmt = this.db.prepare(`
            UPDATE devices SET name = ?, type = ?, description = ?, location = ?, config = ?
            WHERE id = ?
        `);
        stmt.run(data.name, data.type, data.description, data.location, JSON.stringify(data.config || {}), id);
        return this.getDevice(id);
    }

    deleteDevice(id) {
        const stmt = this.db.prepare('DELETE FROM devices WHERE id = ?');
        return stmt.run(id);
    }

    updateDeviceLastSeen(clientId) {
        const stmt = this.db.prepare(`
            UPDATE devices SET last_seen = CURRENT_TIMESTAMP, status = 'online'
            WHERE client_id = ?
        `);
        stmt.run(clientId);
    }

    logDeviceConnection(clientId, event) {
        const stmt = this.db.prepare('INSERT INTO connection_logs (client_id, event) VALUES (?, ?)');
        stmt.run(clientId, event);
        
        const status = event === 'connected' ? 'online' : 'offline';
        const updateStmt = this.db.prepare('UPDATE devices SET status = ? WHERE client_id = ?');
        updateStmt.run(status, clientId);
    }

    // API Key methods
    getAllKeys() {
        const stmt = this.db.prepare(`
            SELECT k.*, d.name as device_name 
            FROM api_keys k 
            LEFT JOIN devices d ON k.device_id = d.id 
            ORDER BY k.created_at DESC
        `);
        return stmt.all();
    }

    getKey(id) {
        const stmt = this.db.prepare('SELECT * FROM api_keys WHERE id = ?');
        return stmt.get(id);
    }

    createKey(data) {
        const id = uuidv4();
        const key = `mqtt_${uuidv4().replace(/-/g, '')}`;
        const stmt = this.db.prepare(`
            INSERT INTO api_keys (id, key, name, device_id, permissions, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, key, data.name, data.device_id, JSON.stringify(data.permissions || ['publish', 'subscribe']), data.expires_at);
        return { id, key, ...data };
    }

    deleteKey(id) {
        const stmt = this.db.prepare('DELETE FROM api_keys WHERE id = ?');
        return stmt.run(id);
    }

    validateApiKey(key) {
        const stmt = this.db.prepare(`
            SELECT * FROM api_keys 
            WHERE key = ? AND is_active = 1 
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `);
        const result = stmt.get(key);
        
        if (result) {
            const updateStmt = this.db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?');
            updateStmt.run(result.id);
        }
        
        return result;
    }

    toggleKeyStatus(id) {
        const stmt = this.db.prepare('UPDATE api_keys SET is_active = NOT is_active WHERE id = ?');
        stmt.run(id);
        return this.getKey(id);
    }

    // Topic methods
    getAllTopics() {
        const stmt = this.db.prepare('SELECT * FROM topics ORDER BY name');
        return stmt.all();
    }

    createTopic(data) {
        const id = uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO topics (id, name, description, data_type, unit, min_value, max_value)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, data.name, data.description, data.data_type, data.unit, data.min_value, data.max_value);
        return { id, ...data };
    }

    deleteTopic(id) {
        const stmt = this.db.prepare('DELETE FROM topics WHERE id = ?');
        return stmt.run(id);
    }

    // Data storage methods
    storeData(clientId, topic, payload) {
        let numericValue = null;
        try {
            const parsed = parseFloat(payload);
            if (!isNaN(parsed)) numericValue = parsed;
        } catch (e) {}

        const stmt = this.db.prepare(`
            INSERT INTO sensor_data (device_id, topic, payload, numeric_value)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(clientId, topic, payload, numericValue);
    }

    getData(options = {}) {
        let query = 'SELECT * FROM sensor_data WHERE 1=1';
        const params = [];

        if (options.device_id) {
            query += ' AND device_id = ?';
            params.push(options.device_id);
        }
        if (options.topic) {
            query += ' AND topic = ?';
            params.push(options.topic);
        }
        if (options.from) {
            query += ' AND created_at >= ?';
            params.push(options.from);
        }
        if (options.to) {
            query += ' AND created_at <= ?';
            params.push(options.to);
        }

        query += ' ORDER BY created_at DESC';
        
        if (options.limit) {
            query += ' LIMIT ?';
            params.push(options.limit);
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    getChartData(topic, hours = 24) {
        const stmt = this.db.prepare(`
            SELECT 
                strftime('%Y-%m-%d %H:00:00', created_at) as hour,
                AVG(numeric_value) as avg_value,
                MIN(numeric_value) as min_value,
                MAX(numeric_value) as max_value,
                COUNT(*) as count
            FROM sensor_data
            WHERE topic = ? 
            AND numeric_value IS NOT NULL
            AND created_at >= datetime('now', '-' || ? || ' hours')
            GROUP BY hour
            ORDER BY hour
        `);
        return stmt.all(topic, hours);
    }

    getStats() {
        const devices = this.db.prepare('SELECT COUNT(*) as count FROM devices').get();
        const keys = this.db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1').get();
        const messages = this.db.prepare('SELECT COUNT(*) as count FROM sensor_data').get();
        const topics = this.db.prepare('SELECT COUNT(DISTINCT topic) as count FROM sensor_data').get();
        const onlineDevices = this.db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get();

        return {
            totalDevices: devices.count,
            onlineDevices: onlineDevices.count,
            activeKeys: keys.count,
            totalMessages: messages.count,
            uniqueTopics: topics.count
        };
    }

    getRecentMessages(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT sd.*, d.name as device_name
            FROM sensor_data sd
            LEFT JOIN devices d ON sd.device_id = d.client_id
            ORDER BY sd.created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getConnectionLogs(limit = 100) {
        const stmt = this.db.prepare(`
            SELECT cl.*, d.name as device_name
            FROM connection_logs cl
            LEFT JOIN devices d ON cl.client_id = d.client_id
            ORDER BY cl.created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

module.exports = MQTTDatabase;
