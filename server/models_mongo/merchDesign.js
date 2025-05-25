const mongoose = require("mongoose");

const MerchDesign = new mongoose.Schema({
  orderId: { type: Number, required: true },
  orderItemId: { type: Number, required: true },
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  designType: { type: String, enum: ['text', 'image', 'combined'], required: true },
  designDetails: {
    text: String,
    textColor: String,
    fontSize: Number,
    position: {
      x: Number,
      y: Number
    },
    imagePosition: {
      x: Number,
      y: Number
    },
    imageSize: {
      width: Number,
      height: Number
    }
  },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.MerchDesign || mongoose.model('MerchDesign', MerchDesign); 