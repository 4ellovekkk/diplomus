const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");
const fs = require("fs");
const libre = require("libreoffice-convert");
const upload = multer({ dest: "uploads/" });

const prisma = new PrismaClient();
const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

const convertToPdf = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(inputPath);
    libre.convert(fileBuffer, ".pdf", undefined, (err, done) => {
      if (err) {
        return reject(err);
      }
      fs.writeFileSync(outputPath, done);
      resolve(outputPath);
    });
  });
};

const handleError = (
  req,
  res,
  error,
  title = "Error",
  message = "Something went wrong",
  status = 500,
) => {
  console.error(title, error);
  const wantsHTML = req.accepts("html");

  if (wantsHTML) {
    res.status(status).render("error", {
      errorTitle: title,
      errorMessage: message,
      errorDetails: { code: status, error: error.message },
    });
  } else {
    res.status(status).json({
      success: false,
      message,
      error: error.message,
    });
  }
};
router.get("/services", async (req, res) => {
  try {
    const services = await prisma.services.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        price: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    res.json({
      success: true,
      services: services
    });

  } catch (error) {
    handleError(
      req,
      res,
      error,
      "Services Error", 
      "Failed to fetch services"
    );
  }
});

router.get("/print", async (req, res) => {
  try {
    let user = null;
    if (req.cookies?.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
    }
    res.render("printing", { user });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      res.clearCookie("token");
      return res.redirect("/api/login");
    }
    handleError(
      req,
      res,
      error,
      "Printing Error",
      "Failed to load printing page"
    );
  }
});

router.post("/get-file-info", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return handleError(
      req,
      res,
      new Error("No file uploaded"),
      "Upload Error",
      "Please upload a document",
      400,
    );
  }

  const filePath = req.file.path;
  const fileExt = path.extname(req.file.originalname).toLowerCase();
  let pageCount = null;
  let convertedFilePath = null;
  let pdfBuffer = null;

  try {
    if (fileExt === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      pageCount = data.numpages || 1;
      pdfBuffer = dataBuffer.toString('base64');
    } else if (fileExt === ".docx" || fileExt === ".doc") {
      try {
        convertedFilePath = filePath + ".pdf";
        await convertToPdf(filePath, convertedFilePath);
        const dataBuffer = fs.readFileSync(convertedFilePath);
        const data = await pdfParse(dataBuffer);
        pageCount = data.numpages || 1;
        pdfBuffer = dataBuffer.toString('base64');
      } catch (conversionError) {
        console.error("Conversion error:", conversionError);
        // Fallback to estimating pages for Word documents
        const content = await mammoth.extractRawText({ path: filePath });
        const wordCount = content.value.split(/\s+/).length;
        pageCount = Math.ceil(wordCount / 500); // Estimate: ~500 words per page
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file format. Please upload a PDF or Word document."
      });
    }

    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: (req.file.size / 1024).toFixed(2) + " KB",
      pages: pageCount,
      pdfData: pdfBuffer
    });
  } catch (error) {
    console.error("File processing error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing file",
      error: error.message
    });
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (convertedFilePath && fs.existsSync(convertedFilePath)) {
        fs.unlinkSync(convertedFilePath);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temporary files:", cleanupError);
    }
  }
});

router.get("/copy", async (req, res) => {
  try {
    let user = null;
    if (req.cookies?.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
    }
    res.render("copy", { user });
  } catch (error) {
    handleError(
      req,
      res,
      error,
      "Copy Service Error",
      "Failed to load copy page",
    );
  }
});

router.get("/merch", async (req, res) => {
  try {
    let user = null;
    if (req.cookies?.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
    }

    const text = req.query.text || "";
    const textColor = req.query.textColor || "#000000";
    const fontSize = req.query.fontSize || 20;

    res.render("merch", { user, text, fontSize, textColor });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      res.clearCookie("token");
      res.render("merch", { 
        user: null, 
        text: req.query.text || "", 
        fontSize: req.query.fontSize || 20,
        textColor: req.query.textColor || "#000000"
      });
    } else {
      handleError(
        req,
        res,
        error,
        "Merch Error",
        "Failed to load merch designer",
      );
    }
  }
});
router.get("/graphic-design", async (req, res) => {
  try {
    let user = null;
    if (req.cookies?.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
    }
    res.render("designer", { user });
  } catch (error) {
    handleError(
      req,
      res,
      error,
      "Graphic Design Error",
      "Failed to load graphic design page",
    );
  }
});

// Get all services
router.get('/services', verifyTokenExceptLogin, async (req, res) => {
  try {
    // Verify user is admin
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const services = await prisma.services.findMany({
      orderBy: { id: 'asc' }
    });

    res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    // Ensure we always send a JSON response
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
});

// Update service price
router.patch('/services/:id/price', verifyTokenExceptLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    if (!price || isNaN(parseFloat(price))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price value'
      });
    }

    // Verify user is admin
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Update service price
    const updatedService = await prisma.services.update({
      where: { id: parseInt(id) },
      data: { price: parseFloat(price) }
    });

    res.json({
      success: true,
      service: updatedService
    });
  } catch (error) {
    console.error('Error updating service price:', error);
    // Ensure we always send a JSON response
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update service price'
    });
  }
});

// Update service details
router.put('/api/services/:id', verifyTokenExceptLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price } = req.body;

    if (!name || !price || isNaN(parseFloat(price))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service data'
      });
    }

    // Verify user is admin
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Update service
    const updatedService = await prisma.services.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        price: parseFloat(price)
      }
    });

    res.json({
      success: true,
      service: updatedService
    });
  } catch (error) {
    console.error('Error updating service:', error);
    // Ensure we always send a JSON response
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update service'
    });
  }
});

// Create new service
router.post('/services', verifyTokenExceptLogin, async (req, res) => {
  try {
    // Verify user is admin
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const { name, description, price } = req.body;

    if (!name || !price || isNaN(parseFloat(price))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service data'
      });
    }

    const service = await prisma.services.create({
      data: {
        name,
        description,
        price: parseFloat(price)
      }
    });

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Error creating service:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create service'
    });
  }
});

// Delete service
router.delete('/services/:id', verifyTokenExceptLogin, async (req, res) => {
  try {
    // Verify user is admin
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const { id } = req.params;

    // Check if service exists
    const existingService = await prisma.services.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Delete the service
    await prisma.services.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete service'
    });
  }
});

module.exports = router;
