const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');

// Get all devices
router.get('/', (req, res) => {
    try {
        const devices = req.db.getAllDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single device
router.get('/:id', (req, res) => {
    try {
        const device = req.db.getDevice(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create device
router.post('/', verifyToken, (req, res) => {
    try {
        const device = req.db.createDevice(req.body);
        res.status(201).json(device);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update device
router.put('/:id', verifyToken, (req, res) => {
    try {
        const device = req.db.updateDevice(req.params.id, req.body);
        res.json(device);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete device
router.delete('/:id', verifyToken, (req, res) => {
    try {
        req.db.deleteDevice(req.params.id);
        res.json({ message: 'Device deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get device data
router.get('/:id/data', (req, res) => {
    try {
        const device = req.db.getDevice(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        const data = req.db.getData({ 
            device_id: device.client_id,
            limit: parseInt(req.query.limit) || 100
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
