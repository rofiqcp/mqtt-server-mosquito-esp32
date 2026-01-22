const express = require('express');
const router = express.Router();

// Get data with filters
router.get('/', (req, res) => {
    try {
        const { device_id, topic, from, to, limit } = req.query;
        const data = req.db.getData({
            device_id,
            topic,
            from,
            to,
            limit: parseInt(limit) || 100
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get chart data
router.get('/chart', (req, res) => {
    try {
        const { topic, hours } = req.query;
        if (!topic) {
            return res.status(400).json({ error: 'Topic is required' });
        }
        const data = req.db.getChartData(topic, parseInt(hours) || 24);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent messages
router.get('/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const data = req.db.getRecentMessages(limit);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get connection logs
router.get('/logs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = req.db.getConnectionLogs(limit);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get unique topics from data
router.get('/topics', (req, res) => {
    try {
        const data = req.db.getData({ limit: 1000 });
        const topics = [...new Set(data.map(d => d.topic))];
        res.json(topics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
