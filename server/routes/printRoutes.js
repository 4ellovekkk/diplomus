const express = require("express");
const router = express.Router();
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const PrintFile = require("../models_mongo/printFile");
const MerchDesign = require("../models_mongo/merchDesign");

// Setup multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const ORDER_STATUS = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  CANCELLED: 4
};

async function calculatePrice({
  copies,
  print_pages,
  color,
  double_sided,
  paper_size,
  service_id,
  totalDocumentPages
}) {
  // Get base price from service
  const service = await prisma.services.findUnique({
    where: { id: service_id }
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const basePricePerPage = parseFloat(service.price); // base price per page from database

  // Convert input values to numbers
  const numCopies = parseInt(copies) || 1;

  // Calculate total pages from page ranges
  let totalPages = 0;
  if (print_pages && print_pages.trim()) {
    const ranges = print_pages.split(',').map(range => range.trim());
    ranges.forEach(range => {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(num => parseInt(num));
        totalPages += end - start + 1;
      } else {
        totalPages += 1; // Single page
      }
    });
  } else {
    // If no pages specified, use total document pages
    totalPages = totalDocumentPages || 1;
  }

  // Adjustments
  const colorMultiplier = color === "true" ? 1.5 : 1; // color prints cost more
  const doubleSidedMultiplier = double_sided === "true" ? 0.75 : 1; // slight discount for double-sided
  const paperSizeMultiplier = paper_size === "A3" ? 1.25 : 1; // larger paper costs more

  const pricePerPage =
    basePricePerPage *
    colorMultiplier *
    doubleSidedMultiplier *
    paperSizeMultiplier;
  
  const total = totalPages * numCopies * pricePerPage;

  return parseFloat(total.toFixed(2)); // round to 2 decimal places
}

router.post("/print", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { print_pages, copies, color, paper_size, double_sided, totalDocumentPages } = req.body;

    // Get the document printing service
    const service = await prisma.services.findUnique({
      where: { name: "Document Printing" }
    });

    if (!service) {
      return res.status(400).send("Document printing service not found");
    }

    // Calculate price based on options and service
    const price = await calculatePrice({
      copies,
      print_pages,
      color,
      double_sided,
      paper_size,
      service_id: service.id,
      totalDocumentPages: parseInt(totalDocumentPages) || 1
    });

    // Construct item for cart
    const cartItem = {
      service_id: service.id,
      name: service.name,
      price: price,
      quantity: parseInt(copies) || 1,
      options: {
        filename: req.file.originalname,
        pages: print_pages && print_pages.trim() ? print_pages : "All",
        color: color === "true" ? "Color" : "Black & White",
        paper_size,
        double_sided: double_sided === "true" ? "Yes" : "No",
        file: {
          mimetype: req.file.mimetype,
          buffer: req.file.buffer
        }
      }
    };

    // Initialize cart if not present
    if (!req.session.cart) {
      req.session.cart = [];
    }

    req.session.cart.push(cartItem);
    req.session.cartSuccess = "Document added to cart successfully";

    res.redirect("/profile#cart"); // Redirect to cart tab on profile page
  } catch (err) {
    console.error("Error processing document:", err);
    req.session.cartError = "Error adding document to cart";
    res.redirect("/profile#cart");
  }
});

// Printing Queue Page Route
router.get("/print-queue", async (req, res) => {
  try {
    // Check if user is logged in and is staff/admin
    if (!req.cookies?.token) {
      return res.redirect("/login");
    }

    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || !['admin', 'employee'].includes(user.role)) {
      return res.redirect("/");
    }

    // Fetch all orders in PROCESSING status with related data
    const orders = await prisma.orders.findMany({
      where: {
        status_id: ORDER_STATUS.PROCESSING
      },
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        },
        order_items: {
          include: {
            service: true
          }
        },
        payment: true
      },
      orderBy: {
        created_at: 'asc' // Oldest first
      }
    });

    res.render("print-queue", { 
      orders,
      user: { role: user.role },
      ORDER_STATUS,
      req,
      locale: req.locale || 'en'  // Pass locale from request or default to 'en'
    });
  } catch (error) {
    console.error("Error loading print queue:", error);
    res.status(500).send("Error loading print queue");
  }
});

// API endpoint to mark order as completed
router.post("/complete-order/:orderId", async (req, res) => {
  try {
    // Check if user is logged in and is staff/admin
    if (!req.cookies?.token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || !['admin', 'employee'].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const orderId = parseInt(req.params.orderId);
    
    // Update order status to completed
    await prisma.orders.update({
      where: { 
        id: orderId,
        status_id: ORDER_STATUS.PROCESSING // Only allow completing orders that are in processing
      },
      data: {
        status_id: ORDER_STATUS.COMPLETED,
        updated_at: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error completing order:", error);
    res.status(500).json({ error: "Error completing order" });
  }
});

// Route to get print file
router.get("/get-print-file/:orderId", async (req, res) => {
  try {
    // Check if user is logged in and is staff/admin
    if (!req.cookies?.token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || !['admin', 'employee'].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const orderId = parseInt(req.params.orderId);
    console.log('Looking for file for order:', orderId);
    
    // Get the order item with the file
    const orderItem = await prisma.order_items.findFirst({
      where: { 
        order_id: orderId
      },
      include: {
        service: true
      }
    });

    if (!orderItem) {
      console.log('Order item not found for order:', orderId);
      return res.status(404).json({ error: "Order item not found" });
    }

    console.log('Found order item:', {
      id: orderItem.id,
      service: orderItem.service.name,
      options: orderItem.options
    });

    // Parse the options to get the type
    const options = JSON.parse(orderItem.options);
    const itemType = options.type || 'service';
    console.log('Item type:', itemType);

    let file;
    if (itemType === 'service') {
      // Get the print file from MongoDB
      console.log('Looking for print file in MongoDB:', {
        orderId,
        orderItemId: orderItem.id
      });
      file = await PrintFile.findOne({ 
        orderId: orderId,
        orderItemId: orderItem.id
      });
    } else if (itemType === 'merch') {
      // Get the merch design from MongoDB
      console.log('Looking for merch design in MongoDB:', {
        orderId,
        orderItemId: orderItem.id
      });
      file = await MerchDesign.findOne({
        orderId: orderId,
        orderItemId: orderItem.id
      });
    }

    if (!file) {
      console.log('File not found in MongoDB for:', {
        orderId,
        orderItemId: orderItem.id,
        type: itemType
      });
      return res.status(404).json({ error: "File not found in order" });
    }

    console.log('Found file:', {
      filename: file.filename,
      contentType: file.contentType,
      dataLength: file.data?.length || 0
    });

    // Set appropriate headers
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    
    // Send the file
    res.send(file.data);
  } catch (error) {
    console.error("Error getting file:", error);
    res.status(500).json({ error: "Error retrieving file" });
  }
});

module.exports = router;
