const session = require("express-session");
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
const passport = require("../config/passport");
const express = require("express");
const router = express.Router();

const handleError = (
  res,
  error,
  message = "An error occurred",
  status = 500,
) => {
  console.error(message, error);
  res.status(status).json({ message, error: error.message });
};
router.post("/cart/add", verifyTokenExceptLogin, async (req, res) => {
  const { service_id, quantity } = req.body;
  const prisma = require("@prisma/client").PrismaClient;
  const db = new prisma();

  // Get service details
  const service = await db.services.findUnique({
    where: { id: parseInt(service_id) },
  });

  if (!service) {
    return res.status(404).send("Service not found");
  }

  if (!req.session.cart) {
    req.session.cart = [];
  }

  // Check if item already exists
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

  res.redirect("/cart");
});
router.get("/cart", verifyTokenExceptLogin, (req, res) => {
  res.render("cart", { cart: req.session.cart || [] });
});
router.post("/cart/checkout", verifyTokenExceptLogin, async (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0) {
    return res.redirect("/cart");
  }

  const userId = req.session.userId; // Ensure the user is logged in
  if (!userId) return res.redirect("/login");

  const prisma = require("@prisma/client").PrismaClient;
  const db = new prisma();

  const totalPrice = req.session.cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Create order
  const order = await db.orders.create({
    data: {
      user_id: userId,
      status_id: 1, // Default status, e.g., "Pending"
      total_price: totalPrice,
      order_items: {
        create: req.session.cart.map((item) => ({
          service_id: item.service_id,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
  });

  // Clear cart session
  req.session.cart = [];

  res.redirect("/orders/" + order.id);
});
module.exports = router;

