const { app, db } = require('./server');

describe('MQTT Dashboard API Tests', () => {
    let token;

    // Test Authentication
    describe('Authentication', () => {
        test('should login with valid credentials', async () => {
            const res = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.token).toBeDefined();
            token = data.token;
        });

        test('should reject invalid credentials', async () => {
            const res = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'wrong' })
            });
            expect(res.status).toBe(401);
        });
    });

    // Test Devices API
    describe('Devices API', () => {
        let deviceId;

        test('should create a device', async () => {
            const res = await fetch('http://localhost:3000/api/devices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: 'Test ESP32',
                    client_id: 'esp32_test_001',
                    type: 'esp32',
                    location: 'Living Room'
                })
            });
            const data = await res.json();
            expect(res.status).toBe(201);
            expect(data.id).toBeDefined();
            deviceId = data.id;
        });

        test('should get all devices', async () => {
            const res = await fetch('http://localhost:3000/api/devices');
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
        });

        test('should get device by id', async () => {
            const res = await fetch(`http://localhost:3000/api/devices/${deviceId}`);
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.name).toBe('Test ESP32');
        });

        test('should update device', async () => {
            const res = await fetch(`http://localhost:3000/api/devices/${deviceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: 'Updated ESP32',
                    type: 'esp32',
                    location: 'Bedroom'
                })
            });
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.name).toBe('Updated ESP32');
        });

        test('should delete device', async () => {
            const res = await fetch(`http://localhost:3000/api/devices/${deviceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            expect(res.status).toBe(200);
        });
    });

    // Test API Keys
    describe('API Keys', () => {
        let keyId;
        let apiKey;

        test('should create API key', async () => {
            const res = await fetch('http://localhost:3000/api/keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: 'Test Key' })
            });
            const data = await res.json();
            expect(res.status).toBe(201);
            expect(data.key).toMatch(/^mqtt_/);
            keyId = data.id;
            apiKey = data.key;
        });

        test('should get all keys', async () => {
            const res = await fetch('http://localhost:3000/api/keys', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
        });

        test('should toggle key status', async () => {
            const res = await fetch(`http://localhost:3000/api/keys/${keyId}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            expect(res.status).toBe(200);
        });

        test('should delete key', async () => {
            const res = await fetch(`http://localhost:3000/api/keys/${keyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            expect(res.status).toBe(200);
        });
    });

    // Test Stats
    describe('Stats API', () => {
        test('should get stats', async () => {
            const res = await fetch('http://localhost:3000/api/stats');
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.totalDevices).toBeDefined();
            expect(data.totalMessages).toBeDefined();
        });
    });

    // Test Data API
    describe('Data API', () => {
        test('should get data with filters', async () => {
            const res = await fetch('http://localhost:3000/api/data?limit=10');
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
        });

        test('should get recent messages', async () => {
            const res = await fetch('http://localhost:3000/api/data/recent');
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
        });
    });
});
