const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');

// Get all API keys
router.get('/', verifyToken, (req, res) => {
    try {
        const keys = req.db.getAllKeys();
        res.json(keys);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single key
router.get('/:id', verifyToken, (req, res) => {
    try {
        const key = req.db.getKey(req.params.id);
        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }
        res.json(key);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create API key
router.post('/', verifyToken, (req, res) => {
    try {
        const key = req.db.createKey(req.body);
        res.status(201).json(key);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Toggle key status
router.patch('/:id/toggle', verifyToken, (req, res) => {
    try {
        const key = req.db.toggleKeyStatus(req.params.id);
        res.json(key);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete API key
router.delete('/:id', verifyToken, (req, res) => {
    try {
        req.db.deleteKey(req.params.id);
        res.json({ message: 'API key deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
