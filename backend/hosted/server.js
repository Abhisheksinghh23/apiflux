// Hosted APIFlux backend (free tier). Differences from the original Express app:
//  - every visitor only sees their own data (random id from the browser, X-Visitor-Id header)
//  - the request proxy refuses private, loopback, link-local and metadata addresses
//    (checked on every DNS lookup, so DNS rebinding does not help), does not follow redirects,
//    and has size, time and rate limits
//  - history never stores secrets (auth values and sensitive headers are blanked) or response bodies
//  - CORS only allows the configured site origins
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://abhisheksinghh23.github.io').split(',').map(s => s.trim());
const MAX_COLLECTIONS = 30, MAX_REQUESTS_PER_COLLECTION = 100, MAX_ENVS = 20, MAX_HISTORY = 100;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024, PROXY_TIMEOUT_MS = 15000;
const TTL_SECONDS = 30 * 24 * 3600;

function buildMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const { MONGO_USER, MONGO_PASS, MONGO_HOST, MONGO_DB = 'apiflux' } = process.env;
  if (!MONGO_USER || !MONGO_PASS || !MONGO_HOST) return null;
  return `mongodb+srv://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}@${MONGO_HOST}/${MONGO_DB}?retryWrites=true&w=majority`;
}

// ---------- blocked address ranges ----------
const blocked = new net.BlockList();
[['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
 ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
 ['224.0.0.0', 4], ['240.0.0.0', 4]].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32], ['100::', 64]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));

function isBlockedAddress(addr) {
  let a = addr;
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(a);
  if (m) a = m[1];
  const fam = net.isIP(a);
  if (!fam) return true;
  return blocked.check(a, fam === 4 ? 'ipv4' : 'ipv6');
}

function safeLookup(hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some(x => isBlockedAddress(x.address))) {
      return cb(new Error('Target address is not allowed'));
    }
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}
const httpAgent = new http.Agent({ lookup: safeLookup, keepAlive: false });
const httpsAgent = new https.Agent({ lookup: safeLookup, keepAlive: false });

function checkTarget(u) {
  if (!['http:', 'https:'].includes(u.protocol)) return 'Only http and https URLs are allowed';
  if (u.username || u.password) return 'Credentials in the URL are not allowed';
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) return 'Invalid host';
  if (net.isIP(host) && isBlockedAddress(host)) return 'Target address is not allowed';
  if (/^localhost$/i.test(host) || /\.(local|internal|localdomain)$/i.test(host)) return 'Target address is not allowed';
  return null;
}

// ---------- models ----------
const ttl = { type: Date, default: Date.now, expires: TTL_SECONDS };
const Collection = mongoose.model('Collection', new mongoose.Schema({
  owner: { type: String, index: true }, name: String, description: String, color: String,
  requests: [mongoose.Schema.Types.Mixed], createdAt: ttl,
}, { minimize: false }));
const Environment = mongoose.model('Environment', new mongoose.Schema({
  owner: { type: String, index: true }, name: String, isActive: Boolean,
  variables: [mongoose.Schema.Types.Mixed], createdAt: ttl,
}, { minimize: false }));
const History = mongoose.model('History', new mongoose.Schema({
  owner: { type: String, index: true }, method: String, url: String, headers: [mongoose.Schema.Types.Mixed],
  params: [mongoose.Schema.Types.Mixed], body: mongoose.Schema.Types.Mixed, auth: mongoose.Schema.Types.Mixed,
  status: Number, success: Boolean, time: Number, createdAt: ttl,
}, { minimize: false }));

// ---------- app ----------
const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  allowedHeaders: ['Content-Type', 'X-Visitor-Id'],
}));
app.use(express.json({ limit: '256kb' }));

// rate limit: per IP, in memory
const hits = new Map();
setInterval(() => hits.clear(), 60 * 1000).unref();
app.use((req, res, next) => {
  const k = req.ip;
  const n = (hits.get(k) || 0) + 1;
  hits.set(k, n);
  if (n > (req.path === '/api/proxy' ? 30 : 240)) return res.status(429).json({ error: 'Too many requests, slow down' });
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 }));

app.use('/api', (req, res, next) => {
  const v = req.get('X-Visitor-Id') || '';
  if (!/^[a-f0-9]{32,64}$/.test(v)) return res.status(400).json({ error: 'Missing visitor id' });
  req.owner = v;
  next();
});

const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|api-key)$/i;
const str = (v, n = 2000) => String(v == null ? '' : v).slice(0, n);
const kvList = (l, max = 50) => (Array.isArray(l) ? l : []).slice(0, max).map(x => ({ key: str(x && x.key, 200), value: str(x && x.value, 4000), enabled: !x || x.enabled !== false }));
const cleanRequest = (b = {}) => ({
  name: str(b.name, 200), method: str(b.method || 'GET', 10).toUpperCase(), url: str(b.url, 4000),
  headers: kvList(b.headers), params: kvList(b.params),
  body: { type: str(b.body && b.body.type || 'none', 40), content: str(b.body && b.body.content, 100000) },
  auth: b.auth && typeof b.auth === 'object' ? JSON.parse(JSON.stringify(b.auth).slice(0, 4000)) : { type: 'none' },
});

// ---------- proxy ----------
app.post('/api/proxy', async (req, res) => {
  const b = cleanRequest(req.body);
  const start = Date.now();
  const fail = (error, code = 400) => res.status(code).json({ error, status: null, time: Date.now() - start });
  const method = b.method;
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) return fail('Unsupported method');
  let u;
  try { u = new URL(b.url); } catch { return fail('Invalid URL'); }
  const bad = checkTarget(u);
  if (bad) return fail(bad);
  const h = {};
  b.headers.filter(x => x.enabled && x.key && !/^(host|content-length|connection|transfer-encoding|x-visitor-id)$/i.test(x.key)).forEach(x => { h[x.key] = x.value; });
  b.params.filter(x => x.enabled && x.key).forEach(x => u.searchParams.set(x.key, x.value));
  const a = b.auth || {};
  if (a.type === 'bearer' && a.token) h.Authorization = 'Bearer ' + a.token;
  else if (a.type === 'basic' && a.username) h.Authorization = 'Basic ' + Buffer.from(`${a.username}:${a.password || ''}`).toString('base64');
  else if (a.type === 'api-key' && a.key) { if (a.addTo === 'header') h[a.key] = a.value; else u.searchParams.set(a.key, a.value); }
  let data;
  if (b.body.type !== 'none' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (b.body.type === 'json') h['Content-Type'] = 'application/json';
    else if (b.body.type === 'x-www-form-urlencoded') h['Content-Type'] = 'application/x-www-form-urlencoded';
    data = b.body.content;
  }
  let result, success = true;
  try {
    const r = await axios({
      method, url: u.toString(), headers: h, data, timeout: PROXY_TIMEOUT_MS, maxRedirects: 0,
      maxContentLength: MAX_RESPONSE_BYTES, maxBodyLength: 256 * 1024, validateStatus: () => true,
      responseType: 'text', transformResponse: [x => x], httpAgent, httpsAgent, decompress: true,
    });
    let parsed = r.data; try { parsed = JSON.parse(r.data); } catch { /* keep text */ }
    const rh = {}; Object.entries(r.headers || {}).forEach(([k, v]) => { if (!/^set-cookie$/i.test(k)) rh[k] = v; });
    result = { status: r.status, statusText: r.statusText || '', headers: rh, data: parsed, time: Date.now() - start, size: Buffer.byteLength(String(r.data || '')) };
    success = r.status < 400;
  } catch (e) {
    success = false;
    result = { error: e.code === 'ECONNABORTED' ? 'Request timed out' : 'Request failed: ' + str(e.message, 200), status: null, time: Date.now() - start };
  }
  if (mongoose.connection.readyState === 1) try {
    const count = await History.countDocuments({ owner: req.owner });
    if (count >= MAX_HISTORY) {
      const old = await History.find({ owner: req.owner }).sort({ createdAt: 1 }).limit(count - MAX_HISTORY + 1).select('_id');
      await History.deleteMany({ _id: { $in: old.map(o => o._id) } });
    }
    await History.create({
      owner: req.owner, method, url: b.url, headers: b.headers.map(x => SENSITIVE_HEADER.test(x.key) ? { ...x, value: '' } : x),
      params: b.params, body: b.body, auth: { type: a.type || 'none' }, status: result.status || null, success, time: result.time,
    });
  } catch { /* history is best effort */ }
  res.status(result.error ? 502 : 200).json(result);
});

// ---------- collections ----------
const own = (req, extra = {}) => ({ owner: req.owner, ...extra });
const idOk = (id) => mongoose.isValidObjectId(id);
const wrap = (fn) => (req, res) => fn(req, res).catch(() => res.status(500).json({ error: 'Server error' }));

app.get('/api/collections', wrap(async (req, res) => res.json(await Collection.find(own(req)).sort({ createdAt: -1 }).lean())));
app.post('/api/collections', wrap(async (req, res) => {
  if (await Collection.countDocuments(own(req)) >= MAX_COLLECTIONS) return res.status(400).json({ error: 'Collection limit reached' });
  const c = await Collection.create({ owner: req.owner, name: str(req.body.name, 100) || 'Untitled', description: str(req.body.description, 500), color: str(req.body.color || '#6366f1', 20), requests: [] });
  res.status(201).json(c);
}));
app.put('/api/collections/:id', wrap(async (req, res) => {
  if (!idOk(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const c = await Collection.findOneAndUpdate(own(req, { _id: req.params.id }), { name: str(req.body.name, 100), description: str(req.body.description, 500), color: str(req.body.color, 20) }, { new: true });
  c ? res.json(c) : res.status(404).json({ error: 'Not found' });
}));
app.delete('/api/collections/:id', wrap(async (req, res) => {
  if (idOk(req.params.id)) await Collection.deleteOne(own(req, { _id: req.params.id }));
  res.json({ message: 'deleted' });
}));
app.post('/api/collections/:id/requests', wrap(async (req, res) => {
  const c = idOk(req.params.id) && await Collection.findOne(own(req, { _id: req.params.id }));
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.requests.length >= MAX_REQUESTS_PER_COLLECTION) return res.status(400).json({ error: 'Request limit reached' });
  c.requests.push({ _id: new mongoose.Types.ObjectId(), ...cleanRequest(req.body) });
  await c.save(); res.status(201).json(c);
}));
app.put('/api/collections/:id/requests/:rid', wrap(async (req, res) => {
  const c = idOk(req.params.id) && await Collection.findOne(own(req, { _id: req.params.id }));
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.requests = c.requests.map(r => String(r._id) === req.params.rid ? { ...r, ...cleanRequest(req.body), _id: r._id } : r);
  c.markModified('requests'); await c.save(); res.json(c);
}));
app.delete('/api/collections/:id/requests/:rid', wrap(async (req, res) => {
  const c = idOk(req.params.id) && await Collection.findOne(own(req, { _id: req.params.id }));
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.requests = c.requests.filter(r => String(r._id) !== req.params.rid);
  c.markModified('requests'); await c.save(); res.json(c);
}));

// ---------- history ----------
app.get('/api/history', wrap(async (req, res) => {
  const rows = await History.find(own(req)).sort({ createdAt: -1 }).limit(MAX_HISTORY).lean();
  res.json(rows);
}));
app.delete('/api/history', wrap(async (req, res) => { await History.deleteMany(own(req)); res.json({ message: 'History cleared' }); }));
app.delete('/api/history/:id', wrap(async (req, res) => { if (idOk(req.params.id)) await History.deleteOne(own(req, { _id: req.params.id })); res.json({ message: 'ok' }); }));

// ---------- environments ----------
app.get('/api/environments', wrap(async (req, res) => res.json(await Environment.find(own(req)).sort({ createdAt: -1 }).lean())));
app.post('/api/environments', wrap(async (req, res) => {
  if (await Environment.countDocuments(own(req)) >= MAX_ENVS) return res.status(400).json({ error: 'Environment limit reached' });
  res.status(201).json(await Environment.create({ owner: req.owner, name: str(req.body.name, 100) || 'Environment', isActive: false, variables: kvList(req.body.variables) }));
}));
app.put('/api/environments/:id', wrap(async (req, res) => {
  if (!idOk(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const e = await Environment.findOneAndUpdate(own(req, { _id: req.params.id }), { name: str(req.body.name, 100), variables: kvList(req.body.variables) }, { new: true });
  e ? res.json(e) : res.status(404).json({ error: 'Not found' });
}));
app.put('/api/environments/:id/activate', wrap(async (req, res) => {
  if (!idOk(req.params.id)) return res.status(404).json({ error: 'Not found' });
  await Environment.updateMany(own(req), { isActive: false });
  const e = await Environment.findOneAndUpdate(own(req, { _id: req.params.id }), { isActive: true }, { new: true });
  e ? res.json(e) : res.status(404).json({ error: 'Not found' });
}));
app.delete('/api/environments/:id', wrap(async (req, res) => { if (idOk(req.params.id)) await Environment.deleteOne(own(req, { _id: req.params.id })); res.json({ message: 'deleted' }); }));

function start() {
  const uri = buildMongoUri();
  if (!uri) { console.error('Set MONGO_URI, or MONGO_USER, MONGO_PASS and MONGO_HOST'); process.exit(1); }
  mongoose.connect(uri).then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log('APIFlux hosted backend on port ' + PORT));
  }).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
}
if (require.main === module) start();

module.exports = { app, isBlockedAddress, checkTarget };
