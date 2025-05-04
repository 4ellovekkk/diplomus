const express = require("express");
const router = express.Router();
const multer = require("multer");

// Setup multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function calculatePrice({
  copies,
  print_pages,
  color,
  double_sided,
  paper_size,
}) {
  const basePricePerPage = 0.1; // base price per page (black & white, A4, single-sided)

  // Convert input values to numbers
  const pages = parseInt(print_pages) || 1;
  const numCopies = parseInt(copies) || 1;

  // Adjustments
  const colorMultiplier = color === "true" ? 1.5 : 1; // color prints cost more
  const doubleSidedMultiplier = double_sided === "true" ? 0.75 : 1; // slight discount for double-sided
  const paperSizeMultiplier = paper_size === "A3" ? 1.25 : 1; // larger paper costs more

  const pricePerPage =
    basePricePerPage *
    colorMultiplier *
    doubleSidedMultiplier *
    paperSizeMultiplier;
  const total = pages * numCopies * pricePerPage;

  return parseFloat(total.toFixed(2)); // round to 2 decimal places
}
router.post("/print", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { print_pages, copies, color, paper_size, double_sided } = req.body;

    // Construct item for cart
    const cartItem = {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
      print_pages,
      copies,
      color,
      paper_size,
      double_sided,
      price: calculatePrice({
        copies,
        print_pages,
        color,
        double_sided,
        paper_size,
      }),
    };

    // Initialize cart if not present
    if (!req.session.cart) {
      req.session.cart = [];
    }

    req.session.cart.push(cartItem);

    res.redirect("/profile#cart"); // Redirect to cart tab on profile page
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing document");
  }
});
module.exports = router;
