const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");
const fs = require("fs");
const libre = require("libreoffice-convert");
const nodemailer = require('nodemailer');
const { PrismaClient } = require("@prisma/client");

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

// Use Prisma client directly
const prisma = new PrismaClient();

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

// Helper function to translate service names
function translateServiceName(serviceName, req) {
  if (!serviceName) return req.__('service_unknown') || 'Unknown Service';
  
  // Map service names to translation keys
  const serviceNameMap = {
    'Document Printing': 'service_document_printing',
    'Custom T-Shirt': 'service_custom_tshirt',
    'Unknown Service': 'service_unknown',
    'Logo Design': 'service_logo_design',
    'Branding': 'service_branding',
    'Social Media Graphics': 'service_social_media_graphics',
    'Print Materials': 'service_print_materials',
    'Graphic Design Consultation': 'service_graphic_design_consultation',
    'Custom merch design': 'service_custom_merch_design',
    'Custom Merch Design': 'service_custom_merch_design',
    'Photocopy': 'service_photocopy',
    'Printing': 'service_printing',
    'Merch Design': 'service_merch_design',
    'Xerox Copy Service': 'service_xerox_copy',
    'Merch': 'merch',
    'Grapic designer consultation': 'service_graphic_designer_consultation',
    'Graphic Designer Consultation': 'service_graphic_designer_consultation',
    'Unknown Product': 'service_unknown_product'
  };
  
  const translationKey = serviceNameMap[serviceName];
  return translationKey ? req.__(translationKey) : serviceName;
}

// Helper function to translate service descriptions
function translateServiceDescription(serviceName, originalDescription, req) {
  if (!serviceName) return originalDescription || '—';
  
  // Map service names to description translation keys
  const serviceDescriptionMap = {
    'Document Printing': 'service_description_document_printing',
    'Custom merch design': 'service_description_custom_merch_design',
    'Custom Merch Design': 'service_description_custom_merch_design',
    'Grapic designer consultation': 'service_description_graphic_designer_consultation',
    'Graphic Designer Consultation': 'service_description_graphic_designer_consultation',
    'Graphic Design Consultation': 'service_description_graphic_designer_consultation',
    'Unknown Product': 'service_description_unknown_product'
  };
  
  const translationKey = serviceDescriptionMap[serviceName];
  return translationKey ? req.__(translationKey) : (originalDescription || '—');
}

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

    // Translate service names and descriptions
    const translatedServices = services
      .filter(service => service.name !== 'Unknown Product') // Hide Unknown Product from admin panel
      .map(service => ({
        ...service,
        name: translateServiceName(service.name, res),
        description: translateServiceDescription(service.name, service.description, res)
      }));

    res.json({
      success: true,
      services: translatedServices
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

// NOTE: Removed conflicting route that was rendering admin page

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
router.put('/services/:id', verifyTokenExceptLogin, async (req, res) => {
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

// Check if service has orders before deletion
router.get('/services/:id/check-orders', verifyTokenExceptLogin, async (req, res) => {
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
        message: res.__('access_denied_admin') || 'Access denied: Admin access required'
      });
    }

    const { id } = req.params;
    const serviceId = parseInt(id);

    // Check if service exists
    const existingService = await prisma.services.findUnique({
      where: { id: serviceId }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: res.__('service_not_found') || 'Service not found'
      });
    }

    // Check if there are any existing orders for this service
    const orderCount = await prisma.order_items.count({
      where: { service_id: serviceId }
    });

    res.json({
      success: true,
      orderCount: orderCount,
      hasOrders: orderCount > 0,
      serviceName: existingService.name
    });
  } catch (error) {
    console.error('Error checking service orders:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: res.__('error_authentication_failed') || 'Authentication failed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: res.__('error_checking_service_orders') || 'Failed to check service orders'
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
        message: res.__('access_denied_admin') || 'Access denied: Admin access required'
      });
    }

    const { id } = req.params;
    const serviceId = parseInt(id);

    // Check if service exists
    const existingService = await prisma.services.findUnique({
      where: { id: serviceId }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: res.__('service_not_found') || 'Service not found'
      });
    }

    // Check if there are any existing orders for this service
    const existingOrders = await prisma.order_items.findFirst({
      where: { service_id: serviceId },
      select: { id: true }
    });

    if (existingOrders) {
      // Get count of orders for better error message
      const orderCount = await prisma.order_items.count({
        where: { service_id: serviceId }
      });

      return res.status(400).json({
        success: false,
        message: res.__('cannot_delete_service_with_orders_detailed', {
          serviceName: translateServiceName(existingService.name, res),
          orderCount: orderCount,
          orderPlural: orderCount > 1 ? res.__('orders') : res.__('order')
        }) || `Cannot delete service "${translateServiceName(existingService.name, res)}" because it has ${orderCount} existing order${orderCount > 1 ? 's' : ''}. Please delete or reassign the orders first, or consider disabling the service instead.`,
        orderCount: orderCount,
        serviceName: existingService.name
      });
    }

    // Delete the service
    await prisma.services.delete({
      where: { id: serviceId }
    });

    res.json({
      success: true,
      message: res.__('service_deleted_successfully_detailed', { serviceName: translateServiceName(existingService.name, res) }) || `Service "${translateServiceName(existingService.name, res)}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: res.__('cannot_delete_service_referenced_by_orders') || 'Cannot delete service because it is referenced by existing orders. Please delete or reassign the orders first.'
      });
    }
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: res.__('error_authentication_failed') || 'Authentication failed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: res.__('failed_to_delete_service') || 'Failed to delete service'
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
        body: (fullName, serviceName) => `
Dear ${fullName},

Thank you for requesting a design consultation with our team. We have received your request for ${serviceName} service.

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
        body: (fullName, serviceName) => `
Уважаемый(ая) ${fullName},

Благодарим вас за запрос на консультацию по дизайну с нашей командой. Мы получили ваш запрос на услугу ${serviceName}.

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

    // Translate service name for email
    const serviceNameMap = {
      logo: 'Logo Design',
      branding: 'Branding',
      social: 'Social Media Graphics',
      print: 'Print Materials'
    };

    const originalServiceName = serviceNameMap[service] || service;
    const translatedServiceName = translateServiceName(originalServiceName, res);

    // Send confirmation email
    await transporter.sendMail({
      from: {
        name: 'Print Center',
        address: `${process.env.SMTP_USER}@yandex.ru`
      },
      to: email,
      subject: template.subject,
      text: template.body(fullName, translatedServiceName)
    });

    res.json({
      success: true,
      message: res.__('consultation_request_received'),
      service: translatedServiceName,
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
