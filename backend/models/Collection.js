const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  method: { type: String, default: 'GET', enum: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'] },
  url: { type: String, default: '' },
  headers: [{ key: String, value: String, enabled: { type: Boolean, default: true } }],
  params: [{ key: String, value: String, enabled: { type: Boolean, default: true } }],
  body: {
    type: { type: String, default: 'none', enum: ['none','json','form-data','x-www-form-urlencoded','raw'] },
    content: { type: String, default: '' }
  },
  auth: {
    type: { type: String, default: 'none', enum: ['none','bearer','basic','api-key'] },
    token: String,
    username: String,
    password: String,
    key: String,
    value: String,
    addTo: { type: String, default: 'header' }
  }
}, { timestamps: true });

const CollectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#6366f1' },
  requests: [RequestSchema]
}, { timestamps: true });

module.exports = mongoose.model('Collection', CollectionSchema);
