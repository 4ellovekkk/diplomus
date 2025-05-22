const express = require("express");
const router = express.Router();
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Setup multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

module.exports = router;
