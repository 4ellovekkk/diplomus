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
const nodemailer = require('nodemailer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Initialize Prisma Client
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  process.exit(1);
}

const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

// Configure email transporter with existing Yandex SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  }
});

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

    if (!user || user.role !== 'admin') {
      return res.status(403).render("error", {
        errorTitle: res.__("access_denied"),
        errorMessage: res.__("access_denied_message"),
        errorDetails: { code: 403 }
      });
    }

    const services = await prisma.services.findMany({
      orderBy: { id: 'asc' }
    });

    res.render("admin", {
      services,
      user: { role: user.role },
      locale: req.locale || 'en'
    });
  } catch (error) {
    console.error('Error loading admin page:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).render("error", {
        errorTitle: res.__("unauthorized_title"),
        errorMessage: res.__("unauthorized_message"),
        errorDetails: { code: 401 }
      });
    }
    res.status(500).render("error", {
      errorTitle: res.__("error_something_wrong"),
      errorMessage: res.__("error_loading_admin_page"),
      errorDetails: { code: 500 }
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

// Add consultation route
router.post("/consultation", upload.single("referenceFile"), async (req, res) => {
  try {
    // Test Prisma connection
    try {
      const testQuery = await prisma.services.findFirst();
      console.log('Prisma connection test:', testQuery ? 'successful' : 'no records found');
    } catch (error) {
      console.error('Prisma connection test failed:', error);
      throw new Error('Database connection failed');
    }

    const { fullName, email, service, description, urgent } = req.body;
    const locale = req.getLocale();

    // Save consultation request to database using your existing table structure
    const consultation = await prisma.consultations.create({
      data: {
        fullName,
        email,
        service,
        description,
        urgent: urgent === 'yes',
        referenceFile: req.file ? req.file.filename : null
      }
    });

    // Email templates for different languages
    const emailTemplates = {
      en: {
        subject: 'Design Consultation Request Confirmation',
        body: `
Dear ${fullName},

Thank you for requesting a design consultation with our team. We have received your request for ${service} service.

Here's what happens next:
1. Our design team will review your request
2. We will contact you within 24 hours to schedule your consultation
3. During the consultation, we'll discuss your project in detail and provide initial recommendations

If you have any questions in the meantime, please don't hesitate to contact us.

Best regards,
Print Center Team
        `
      },
      ru: {
        subject: 'Подтверждение запроса на консультацию по дизайну',
        body: `
Уважаемый(ая) ${fullName},

Благодарим вас за запрос на консультацию по дизайну с нашей командой. Мы получили ваш запрос на услугу ${service}.

Что будет дальше:
1. Наша команда дизайнеров рассмотрит ваш запрос
2. Мы свяжемся с вами в течение 24 часов для планирования консультации
3. Во время консультации мы детально обсудим ваш проект и предоставим первоначальные рекомендации

Если у вас возникнут вопросы, пожалуйста, не стесняйтесь обращаться к нам.

С наилучшими пожеланиями,
Команда Print Center
        `
      }
    };

    // Get template based on locale
    const template = emailTemplates[locale] || emailTemplates.en;

    // Send confirmation email
    await transporter.sendMail({
      from: {
        name: 'Print Center',
        address: `${process.env.SMTP_USER}@yandex.ru`
      },
      to: email,
      subject: template.subject,
      text: template.body
    });

    // Translate service names for response message
    const serviceTranslations = {
      en: {
        logo: 'Logo Design',
        branding: 'Branding',
        social: 'Social Media Graphics',
        print: 'Print Materials'
      },
      ru: {
        logo: 'Дизайн логотипа',
        branding: 'Брендинг',
        social: 'Графика для социальных сетей',
        print: 'Печатные материалы'
      }
    };

    const translatedService = serviceTranslations[locale]?.[service] || service;

    res.json({
      success: true,
      message: res.__('consultation_request_received'),
      service: translatedService,
      consultationId: consultation.id
    });

  } catch (error) {
    console.error('Consultation request error:', error);
    res.status(500).json({
      success: false,
      message: res.__('consultation_request_error'),
      error: error.message
    });
  }
});

module.exports = router;
