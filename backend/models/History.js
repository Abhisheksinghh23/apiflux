const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  method: String,
  url: String,
  headers: Array,
  params: Array,
  body: Object,
  auth: Object,
  response: {
    status: Number,
    statusText: String,
    headers: Object,
    data: mongoose.Schema.Types.Mixed,
    time: Number,
    size: Number
  },
  success: Boolean
}, { timestamps: true });

module.exports = mongoose.model('History', HistorySchema);
