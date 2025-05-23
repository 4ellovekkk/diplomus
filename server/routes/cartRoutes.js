const session = require("express-session");
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
const passport = require("../config/passport");
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const verifyToken = require('../middleware/authMiddleware');

// Helper function to handle errors and redirect to profile
const handleError = (req, res, error, message = "An error occurred") => {
  console.error(message, error);
  req.session.cartError = error.message || message;
  res.redirect('/profile#cart');
};

// Helper functions for cart calculations
const calculateCartTotal = (cart) => {
  return cart.reduce((total, item) => {
    // For merch items, use fixed price
    const price = item.type === 'merch' ? 1500 : item.price; // 1500 rubles for t-shirts
    return total + (price * item.quantity);
  }, 0);
};

const calculateItemCount = (cart) => {
  return cart.reduce((count, item) => count + item.quantity, 0);
};

// Get cart data
router.get("/cart/data", verifyTokenExceptLogin, async (req, res) => {
  try {
    // Initialize cart if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Get fresh service details for display
    const cartWithDetails = await Promise.all(
      req.session.cart.map(async (item) => {
        if (item.type === 'merch') {
          return {
            ...item,
            name: 'Custom T-Shirt',
            price: 1500, // Fixed price for t-shirts
            service_description: 'Custom designed t-shirt'
          };
        }

        const service = await prisma.services.findUnique({
          where: { id: item.service_id },
        });

        // Translate options if they exist
        const translatedOptions = {};
        if (item.options) {
          for (const [key, value] of Object.entries(item.options)) {
            // Skip file and design options as they're technical fields
            if (key === 'file' || key === 'design') continue;
            
            // Translate the option key and value
            const translatedKey = res.__(key);
            const translatedValue = res.__(String(value));
            translatedOptions[translatedKey] = translatedValue;
          }
        }

        return {
          ...item,
          service_description: service.description,
          options: translatedOptions
        };
      })
    );

    res.json({
      cart: cartWithDetails,
      cartTotal: calculateCartTotal(req.session.cart),
      itemCount: calculateItemCount(req.session.cart),
      success: req.session.cartSuccess,
      error: req.session.cartError
    });

    // Clear messages after sending
    delete req.session.cartSuccess;
    delete req.session.cartError;
  } catch (error) {
    res.status(500).json({
      error: "Failed to load cart",
      cart: [],
      cartTotal: 0,
      itemCount: 0
    });
  }
});

// Add merch to cart
router.post("/cart/add-merch", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { options } = req.body;

    // Validate required fields
    if (!options.size || !options.design) {
      return res.status(400).json({
        success: false,
        message: 'Size and design are required'
      });
    }

    // Initialize cart if needed
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Add merch item to cart
    req.session.cart.push({
      type: 'merch',
      name: 'Custom T-Shirt',
      price: 1500, // Fixed price for t-shirts
      quantity: 1,
      options: {
        size: options.size,
        text: options.text || null,
        textColor: options.textColor || null,
        fontSize: options.fontSize || null,
        design: options.design
      }
    });

    req.session.cartSuccess = "T-shirt added to cart";
    req.session.save(() => {
      res.json({
        success: true,
        message: 'T-shirt added to cart successfully'
      });
    });
  } catch (error) {
    console.error('Error adding merch to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add t-shirt to cart'
    });
  }
});

// Add to cart
router.post("/cart/add", verifyTokenExceptLogin, async (req, res) => {
  const { service_id, quantity = 1, options = {} } = req.body;

  try {
    // Verify service exists and get its current price
    const service = await prisma.services.findUnique({
      where: { id: parseInt(service_id) },
      select: { id: true, name: true, price: true }
    });

    if (!service) {
      req.session.cartError = "Service not found";
      return res.redirect('/profile#cart');
    }

    // Initialize cart if needed
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Check for existing item with same service and options
    const existingItemIndex = req.session.cart.findIndex(item => 
      item.service_id === service.id && 
      JSON.stringify(item.options) === JSON.stringify(options)
    );

    if (existingItemIndex !== -1) {
      // Update existing item
      req.session.cart[existingItemIndex].quantity += parseInt(quantity);
    } else {
      // Add new item
      req.session.cart.push({
        service_id: service.id,
        name: service.name,
        price: parseFloat(service.price),
        quantity: parseInt(quantity),
        options: options
      });
    }

    req.session.cartSuccess = "Item added to cart";
    req.session.save(() => {
      res.redirect('/profile#cart');
    });
  } catch (error) {
    handleError(req, res, error, "Failed to add item to cart");
  }
});

// Update cart item quantity
router.post("/cart/update", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { index, quantity } = req.body;

    if (!req.session.cart || !req.session.cart[index]) {
      return res.status(400).json({
        error: "Invalid cart item"
      });
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      req.session.cart.splice(index, 1);
      req.session.cartSuccess = "Item removed from cart";
    } else {
      req.session.cart[index].quantity = parseInt(quantity);
      req.session.cartSuccess = "Cart updated successfully";
    }

    await req.session.save();
    
    // Return updated cart data
    res.json({
      success: req.session.cartSuccess,
      cart: req.session.cart,
      cartTotal: calculateCartTotal(req.session.cart),
      itemCount: calculateItemCount(req.session.cart)
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({
      error: "Failed to update cart item"
    });
  }
});

// Remove item from cart
router.post("/cart/remove", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { index } = req.body;

    if (!req.session.cart || !req.session.cart[index]) {
      return res.status(400).json({
        error: "Invalid cart item"
      });
    }

    const removedItemName = req.session.cart[index].name;
    req.session.cart.splice(index, 1);
    req.session.cartSuccess = `${removedItemName} removed from cart`;

    await req.session.save();
    
    // Return updated cart data
    res.json({
      success: req.session.cartSuccess,
      cart: req.session.cart,
      cartTotal: calculateCartTotal(req.session.cart),
      itemCount: calculateItemCount(req.session.cart)
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    res.status(500).json({
      error: "Failed to remove cart item"
    });
  }
});

// Clear entire cart
router.post("/cart/clear", verifyTokenExceptLogin, async (req, res) => {
  try {
    req.session.cart = [];
    req.session.cartSuccess = "Cart cleared successfully";

    await req.session.save();
    
    // Return updated cart data
    res.json({
      success: req.session.cartSuccess,
      cart: [],
      cartTotal: 0,
      itemCount: 0
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({
      error: "Failed to clear cart"
    });
  }
});

module.exports = router;
