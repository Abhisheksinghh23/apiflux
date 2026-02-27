const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/collections', require('./routes/collections'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/proxy', require('./routes/proxy'));
app.use('/api/history', require('./routes/history'));
app.use('/api/environments', require('./routes/environments'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'API Tester Backend Running' }));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apitester';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    // Start server anyway for demo purposes
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (without DB)`));
  });

module.exports = app;
