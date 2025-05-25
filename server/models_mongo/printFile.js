const mongoose = require("mongoose");

const PrintFile = new mongoose.Schema({
  orderId: { type: Number, required: true },
  orderItemId: { type: Number, required: true },
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.PrintFile || mongoose.model('PrintFile', PrintFile); 