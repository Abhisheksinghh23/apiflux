require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Models
const RequestSchema = new mongoose.Schema({
  collectionId: String,
  name: String,
  method: { type: String, default: 'GET' },
  url: String,
  headers: [{ key: String, value: String, enabled: Boolean }],
  params: [{ key: String, value: String, enabled: Boolean }],
  body: { type: String, default: '' },
  bodyType: { type: String, default: 'none' },
  auth: {
    type: { type: String, default: 'none' },
    token: String,
    username: String,
    password: String,
    apiKey: String,
    apiKeyHeader: String,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const CollectionSchema = new mongoose.Schema({
  name: String,
  description: String,
  color: { type: String, default: '#6366f1' },
  createdAt: { type: Date, default: Date.now },
});

const HistorySchema = new mongoose.Schema({
  method: String,
  url: String,
  statusCode: Number,
  responseTime: Number,
  requestData: Object,
  responseData: Object,
  timestamp: { type: Date, default: Date.now },
});

const EnvironmentSchema = new mongoose.Schema({
  name: String,
  variables: [{ key: String, value: String, enabled: Boolean }],
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Request = mongoose.model('Request', RequestSchema);
const Collection = mongoose.model('Collection', CollectionSchema);
const History = mongoose.model('History', HistorySchema);
const Environment = mongoose.model('Environment', EnvironmentSchema);

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apitester';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('⚠️  MongoDB not connected, running in memory mode:', err.message));

// ===================== PROXY ROUTE =====================
const axios = require('axios');

app.post('/api/proxy', async (req, res) => {
  const { method, url, headers, params, body, bodyType, auth } = req.body;
  const startTime = Date.now();

  try {
    // Build headers
    const requestHeaders = {};
    if (headers) {
      headers.filter(h => h.enabled && h.key).forEach(h => {
        requestHeaders[h.key] = h.value;
      });
    }

    // Auth
    if (auth) {
      if (auth.type === 'bearer' && auth.token) {
        requestHeaders['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'apikey' && auth.apiKey) {
        requestHeaders[auth.apiKeyHeader || 'X-API-Key'] = auth.apiKey;
      }
    }

    // Build params
    const requestParams = {};
    if (params) {
      params.filter(p => p.enabled && p.key).forEach(p => {
        requestParams[p.key] = p.value;
      });
    }

    // Build body
    let requestBody = undefined;
    if (bodyType === 'json' && body) {
      requestBody = JSON.parse(body);
      requestHeaders['Content-Type'] = 'application/json';
    } else if (bodyType === 'text' && body) {
      requestBody = body;
      requestHeaders['Content-Type'] = 'text/plain';
    } else if (bodyType === 'form-urlencoded' && body) {
      requestBody = body;
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const axiosConfig = {
      method: method.toLowerCase(),
      url,
      headers: requestHeaders,
      params: requestParams,
      data: requestBody,
      validateStatus: () => true,
      timeout: 30000,
    };

    // Basic auth
    if (auth && auth.type === 'basic' && auth.username) {
      axiosConfig.auth = { username: auth.username, password: auth.password };
    }

    const response = await axios(axiosConfig);
    const responseTime = Date.now() - startTime;

    const responseData = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      responseTime,
      size: JSON.stringify(response.data).length,
    };

    // Save to history
    try {
      await History.create({
        method,
        url,
        statusCode: response.status,
        responseTime,
        requestData: req.body,
        responseData,
      });
    } catch (e) {}

    res.json({ success: true, response: responseData });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    res.json({
      success: false,
      error: error.message,
      responseTime,
    });
  }
});

// ===================== COLLECTIONS =====================
app.get('/api/collections', async (req, res) => {
  try {
    const collections = await Collection.find().sort({ createdAt: -1 });
    res.json(collections);
  } catch (e) { res.json([]); }
});

app.post('/api/collections', async (req, res) => {
  try {
    const col = await Collection.create(req.body);
    res.json(col);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/collections/:id', async (req, res) => {
  try {
    const col = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(col);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/collections/:id', async (req, res) => {
  try {
    await Collection.findByIdAndDelete(req.params.id);
    await Request.deleteMany({ collectionId: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== REQUESTS =====================
app.get('/api/requests', async (req, res) => {
  try {
    const query = req.query.collectionId ? { collectionId: req.query.collectionId } : {};
    const requests = await Request.find(query).sort({ updatedAt: -1 });
    res.json(requests);
  } catch (e) { res.json([]); }
});

app.post('/api/requests', async (req, res) => {
  try {
    const r = await Request.create(req.body);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/requests/:id', async (req, res) => {
  try {
    const r = await Request.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/requests/:id', async (req, res) => {
  try {
    await Request.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== HISTORY =====================
app.get('/api/history', async (req, res) => {
  try {
    const history = await History.find().sort({ timestamp: -1 }).limit(100);
    res.json(history);
  } catch (e) { res.json([]); }
});

app.delete('/api/history', async (req, res) => {
  try {
    await History.deleteMany({});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== ENVIRONMENTS =====================
app.get('/api/environments', async (req, res) => {
  try {
    const envs = await Environment.find().sort({ createdAt: -1 });
    res.json(envs);
  } catch (e) { res.json([]); }
});

app.post('/api/environments', async (req, res) => {
  try {
    const env = await Environment.create(req.body);
    res.json(env);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/environments/:id', async (req, res) => {
  try {
    const env = await Environment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(env);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/environments/:id', async (req, res) => {
  try {
    await Environment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 API Tester backend running on port ${PORT}`));
