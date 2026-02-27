const express = require('express');
const router = express.Router();
const axios = require('axios');
const History = require('../models/History');

router.post('/', async (req, res) => {
  const { method, url, headers = [], params = [], body, auth } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  const startTime = Date.now();

  try {
    // Build headers object
    const headersObj = {};
    headers.filter(h => h.enabled && h.key).forEach(h => {
      headersObj[h.key] = h.value;
    });

    // Build params object
    const paramsObj = {};
    params.filter(p => p.enabled && p.key).forEach(p => {
      paramsObj[p.key] = p.value;
    });

    // Handle auth
    if (auth) {
      if (auth.type === 'bearer' && auth.token) {
        headersObj['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'basic' && auth.username) {
        const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headersObj['Authorization'] = `Basic ${encoded}`;
      } else if (auth.type === 'api-key' && auth.key) {
        if (auth.addTo === 'header') {
          headersObj[auth.key] = auth.value;
        } else {
          paramsObj[auth.key] = auth.value;
        }
      }
    }

    // Build request body
    let requestData = undefined;
    if (body && body.type !== 'none' && ['POST','PUT','PATCH'].includes(method?.toUpperCase())) {
      if (body.type === 'json') {
        headersObj['Content-Type'] = 'application/json';
        try {
          requestData = JSON.parse(body.content);
        } catch {
          requestData = body.content;
        }
      } else if (body.type === 'raw') {
        requestData = body.content;
      } else if (body.type === 'x-www-form-urlencoded') {
        headersObj['Content-Type'] = 'application/x-www-form-urlencoded';
        requestData = body.content;
      }
    }

    const response = await axios({
      method: method || 'GET',
      url,
      headers: headersObj,
      params: paramsObj,
      data: requestData,
      timeout: 30000,
      validateStatus: () => true // Don't throw on any HTTP status
    });

    const endTime = Date.now();
    const timeTaken = endTime - startTime;

    // Calculate response size
    const responseText = JSON.stringify(response.data);
    const size = new TextEncoder().encode(responseText).length;

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      time: timeTaken,
      size
    };

    // Save to history
    try {
      await History.create({
        method, url, headers, params, body, auth,
        response: result,
        success: response.status < 400
      });
    } catch (histErr) {
      console.error('History save failed:', histErr.message);
    }

    res.json(result);

  } catch (err) {
    const endTime = Date.now();
    const errorResult = {
      error: err.message,
      time: endTime - startTime,
      status: null
    };

    // Save failed request to history
    try {
      await History.create({
        method, url, headers, params, body, auth,
        response: { status: null, data: err.message, time: endTime - startTime },
        success: false
      });
    } catch {}

    res.status(500).json(errorResult);
  }
});

module.exports = router;
