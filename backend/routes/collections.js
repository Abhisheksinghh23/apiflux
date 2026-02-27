const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');

// Get all collections
router.get('/', async (req, res) => {
  try {
    const collections = await Collection.find().sort({ createdAt: -1 });
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create collection
router.post('/', async (req, res) => {
  try {
    const collection = new Collection(req.body);
    await collection.save();
    res.status(201).json(collection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update collection
router.put('/:id', async (req, res) => {
  try {
    const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(collection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete collection
router.delete('/:id', async (req, res) => {
  try {
    await Collection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Collection deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add request to collection
router.post('/:id/requests', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    collection.requests.push(req.body);
    await collection.save();
    res.status(201).json(collection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update request in collection
router.put('/:id/requests/:requestId', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    const reqIndex = collection.requests.findIndex(r => r._id.toString() === req.params.requestId);
    if (reqIndex === -1) return res.status(404).json({ error: 'Request not found' });
    collection.requests[reqIndex] = { ...collection.requests[reqIndex].toObject(), ...req.body };
    await collection.save();
    res.json(collection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete request from collection
router.delete('/:id/requests/:requestId', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    collection.requests = collection.requests.filter(r => r._id.toString() !== req.params.requestId);
    await collection.save();
    res.json(collection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
