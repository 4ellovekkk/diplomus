const session = require("express-session");
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
const passport = require("../config/passport");
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const verifyToken = require('../middleware/authMiddleware');
const MerchDesign = require("../models_mongo/merchDesign");

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
    const price = item.type === 'merch' ? 149.99 : item.price; // $149.99 for t-shirts
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
            name: req.__('custom_tshirt'),
            price: 149.99, // Fixed price for t-shirts ($149.99)
            service_description: req.__('custom_tshirt_desc'),
            options: {
              ...item.options,
              type: 'merch',
              design: item.options.design // Keep the design data
            }
          };
        }

        const service = await prisma.services.findUnique({
          where: { id: item.service_id },
        });

        return {
          ...item,
          service_description: service.description,
          options: item.options
        };
      })
    );

    // Make cart data available to client-side JavaScript
    const responseData = {
      cart: cartWithDetails,
      cartTotal: calculateCartTotal(req.session.cart),
      itemCount: calculateItemCount(req.session.cart),
      success: req.session.cartSuccess ? req.__(req.session.cartSuccess) : null,
      error: req.session.cartError ? req.__(req.session.cartError) : null
    };

    // Send the response
    res.json(responseData);

    // Clear messages after sending
    delete req.session.cartSuccess;
    delete req.session.cartError;
  } catch (error) {
    console.error('Error getting cart data:', error);
    res.status(500).json({ error: 'Failed to get cart data' });
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

    // Get the Custom T-Shirt service by ID
    const service = await prisma.services.findUnique({
      where: { id: 2 } // Custom T-Shirt service ID
    });

    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Custom T-Shirt service not found'
      });
    }

    // Initialize cart if needed
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Create the cart item
    const cartItem = {
      type: 'merch',
      service_id: service.id,
      name: 'Custom T-Shirt',
      price: 149.99, // Fixed price for t-shirts ($149.99)
      quantity: 1,
      options: {
        type: 'merch',
        size: options.size,
        text: options.text || null,
        textColor: options.textColor || null,
        fontSize: options.fontSize || null,
        position: options.position || null,
        imagePosition: options.imagePosition || null,
        imageSize: options.imageSize || null,
        design: options.design, // Store the base64 design data
        designId: options.designId // Store the design ID
      }
    };

    // Add to cart
    req.session.cart.push(cartItem);

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
        error: req.__("error_update_cart")
      });
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      req.session.cart.splice(index, 1);
      req.session.cartSuccess = "item_removed";
    } else {
      req.session.cart[index].quantity = parseInt(quantity);
      req.session.cartSuccess = "cart_updated";
    }

    await req.session.save();
    
    // Return updated cart data
    res.json({
      success: req.__(req.session.cartSuccess),
      cart: req.session.cart,
      cartTotal: calculateCartTotal(req.session.cart),
      itemCount: calculateItemCount(req.session.cart)
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({
      error: req.__("error_update_cart")
    });
  }
});

// Remove item from cart
router.post("/cart/remove", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { index } = req.body;

    if (!req.session.cart || !req.session.cart[index]) {
      return res.status(400).json({
        error: req.__("error_remove_item")
      });
    }

    const removedItem = req.session.cart[index];
    req.session.cart.splice(index, 1);
    
    // Set success message based on item type
    const itemName = removedItem.type === 'merch' ? req.__('custom_tshirt') : removedItem.name;
    req.session.cartSuccess = "item_removed_name";

    await req.session.save();
    
    // Return updated cart data
    res.json({
      success: req.__("item_removed_name").replace('{name}', itemName),
      cart: req.session.cart,
      cartTotal: calculateCartTotal(req.session.cart),
      itemCount: calculateItemCount(req.session.cart)
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    res.status(500).json({
      error: req.__("error_remove_item")
    });
  }
});

// Clear entire cart
router.post("/cart/clear", verifyTokenExceptLogin, async (req, res) => {
  try {
    req.session.cart = [];
    req.session.cartSuccess = "cart_cleared";

    await req.session.save();
    
    // Return updated cart data
    res.json({
      success: req.__("cart_cleared"),
      cart: [],
      cartTotal: 0,
      itemCount: 0
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({
      error: req.__("error_clear_cart")
    });
  }
});

// Save merch design
router.post("/save-merch-design", verifyTokenExceptLogin, async (req, res) => {
    try {
        const { designData, designDetails } = req.body;
        
        // Convert base64 to buffer
        const base64Data = designData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Create new design document without order information
        const design = await MerchDesign.create({
            filename: `design-${Date.now()}.jpg`,
            contentType: 'image/jpeg',
            data: buffer,
            designType: designDetails.imagePosition ? 'combined' : 'text',
            designDetails: designDetails,
            uploadedAt: new Date(),
            orderId: null, // Explicitly set to null
            orderItemId: null // Explicitly set to null
        });

        console.log('Design saved successfully:', {
            designId: design._id,
            filename: design.filename
        });

        res.json({
            success: true,
            designId: design._id
        });
    } catch (error) {
        console.error('Error saving merch design:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save design'
        });
    }
});

module.exports = router;
