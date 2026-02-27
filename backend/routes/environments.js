const express = require('express');
const router = express.Router();
const Environment = require('../models/Environment');

router.get('/', async (req, res) => {
  try {
    const envs = await Environment.find().sort({ createdAt: -1 });
    res.json(envs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const env = new Environment(req.body);
    await env.save();
    res.status(201).json(env);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const env = await Environment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(env);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/activate', async (req, res) => {
  try {
    await Environment.updateMany({}, { isActive: false });
    const env = await Environment.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    res.json(env);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Environment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Environment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
