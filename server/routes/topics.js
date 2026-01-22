const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');

// Get all topics
router.get('/', (req, res) => {
    try {
        const topics = req.db.getAllTopics();
        res.json(topics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create topic
router.post('/', verifyToken, (req, res) => {
    try {
        const topic = req.db.createTopic(req.body);
        res.status(201).json(topic);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete topic
router.delete('/:id', verifyToken, (req, res) => {
    try {
        req.db.deleteTopic(req.params.id);
        res.json({ message: 'Topic deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
