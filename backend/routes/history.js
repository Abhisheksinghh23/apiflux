const express = require('express');
const router = express.Router();
const History = require('../models/History');

router.get('/', async (req, res) => {
  try {
    const history = await History.find().sort({ createdAt: -1 }).limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    await History.deleteMany({});
    res.json({ message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await History.findByIdAndDelete(req.params.id);
    res.json({ message: 'History item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
