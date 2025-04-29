const mongoose = require("mongoose");

const Document = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true }, // e.g., 'image/png'
  data: { type: Buffer, required: true }, // Binary data
  uploadedAt: { type: Date, default: Date.now },
  orderId: { type: Number, required: true },
  userId: { type: Number, required: true },
});

module.exports = mongoose.models.Document || mongoose.model('Document', DocumentSchema);

