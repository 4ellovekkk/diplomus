const express = require("express");
const router = express.Router();
const multer = require("multer");
const DocumentModel = require("../models_mongo/documents.js");

// Setup multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
router.post("/print", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { print_pages, copies, color, paper_size, double_sided } = req.body;

    const newDocument = new DocumentModel({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      data: req.file.buffer,
      // Replace with your actual logic for orderId and userId
      orderId: 1234,
      userId: 5678,
    });

    await newDocument.save();

    res.redirect("/cart"); // or wherever you want to redirect after successful upload
  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading document");
  }
});

module.exports = router;

