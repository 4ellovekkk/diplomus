const session = require("express-session");
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
const passport = require("../config/passport");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // Use memory storage to access file buffer

const handleError = (
  res,
  error,
  message = "An error occurred",
  status = 500,
) => {
  console.error(message, error);
  res.status(status).json({ message, error: error.message });
};
// Add these new routes to your existing cart routes

// Update cart item quantity
router.post("/cart/update", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { index, quantity } = req.body;

    if (!req.session.cart || !req.session.cart[index]) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid cart item" });
    }

    req.session.cart[index].quantity = parseInt(quantity);
    req.session.save(() => {
      res.redirect("/profile#cart");
    });
  } catch (error) {
    handleError(res, error, "Failed to update cart item");
  }
});

// Remove item from cart
router.post("/cart/remove", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { index } = req.body;

    if (!req.session.cart || !req.session.cart[index]) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid cart item" });
    }

    req.session.cart.splice(index, 1);
    req.session.save(() => {
      res.redirect("/profile#cart");
    });
  } catch (error) {
    handleError(res, error, "Failed to remove cart item");
  }
});

// Clear entire cart
router.post("/cart/clear", verifyTokenExceptLogin, async (req, res) => {
  try {
    req.session.cart = [];
    req.session.save(() => {
      res.redirect("/profile#cart");
    });
  } catch (error) {
    handleError(res, error, "Failed to clear cart");
  }
});

// Modify your existing cart/add route to handle JSON responses
router.post("/cart/add", verifyTokenExceptLogin, async (req, res) => {
  const { service_id, quantity } = req.body;
  const prisma = require("@prisma/client").PrismaClient;
  const db = new prisma();

  try {
    const service = await db.services.findUnique({
      where: { id: parseInt(service_id) },
    });

    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    if (!req.session.cart) {
      req.session.cart = [];
    }

    let existingItem = req.session.cart.find(
      (item) => item.service_id === service.id,
    );

    if (existingItem) {
      existingItem.quantity += parseInt(quantity);
    } else {
      req.session.cart.push({
        service_id: service.id,
        name: service.name,
        price: service.price,
        quantity: parseInt(quantity),
      });
    }

    req.session.save(() => {
      if (req.accepts("json")) {
        res.json({
          success: true,
          cart: req.session.cart,
          cartCount: req.session.cart.reduce(
            (sum, item) => sum + (item.quantity || item.copies || 1),
            0,
          ),
        });
      } else {
        res.redirect("/profile#cart");
      }
    });
  } catch (error) {
    handleError(res, error, "Failed to add to cart");
  }
});
module.exports = router;
