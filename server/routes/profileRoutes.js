const express = require("express");
const jwt = require("jsonwebtoken");
const Avatar = require("../models_mongo/avatar.js");
const verifyTokenExceptLogin = require("../middleware/authMiddleware.js");
const router = express.Router();

const multer = require("multer");
const storage = multer.memoryStorage(); // store in memory as Buffer
const upload = multer({ storage });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Helper function to calculate cart totals
const calculateCartTotals = (cart) => {
  return cart.reduce((totals, item) => ({
    total: totals.total + (item.price * item.quantity),
    itemCount: totals.itemCount + item.quantity
  }), { total: 0, itemCount: 0 });
};


router.get("/profile", verifyTokenExceptLogin, async (req, res) => {
  try {
    // Decode the JWT token to get the user ID
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);

    // Fetch the user from SQL DB (Prisma)
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: { orders: true },
    });

    if (!user) {
      return res.status(404).render("error", {
        errorTitle: "User not found",
        errorMessage: "Check if user credentials you provided are correct",
        errorDetails: { code: 404, info: "Not found" },
      });
    }

    // Fetch user's avatar from MongoDB (Mongoose)
    const avatarDoc = await Avatar.findOne({ userId: user.id });

    let avatarBase64 = null;
    if (avatarDoc && avatarDoc.data) {
      avatarBase64 = `data:${avatarDoc.contentType};base64,${avatarDoc.data.toString("base64")}`;
    }

    // Get cart data from session
    const cart = req.session.cart || [];

    // Process cart items once
    const processedCart = await Promise.all(
      cart.map(async (item, index) => {
        // For merchandise items
        if (item.type === 'merch') {
          const processedItem = { ...item };
          if (processedItem.options?.design) {
            // Add view design information instead of HTML button
            processedItem.hasDesign = true;
            processedItem.designIndex = index;
            delete processedItem.options.design; // Remove the actual design data
          }
          return processedItem;
        }
        
        // For service items
        if (item.service_id) {
          const service = await prisma.services.findUnique({
            where: { id: item.service_id },
          });
          return {
            ...item,
            service_description: service ? service.description : null
          };
        }
        
        return item;
      })
    );

    const { total: cartTotal, itemCount } = calculateCartTotals(processedCart);

    // Get cart messages from session and clear them
    const cartSuccess = req.session.cartSuccess;
    const cartError = req.session.cartError;
    delete req.session.cartSuccess;
    delete req.session.cartError;

    // If there's a cart hash parameter, switch to cart tab
    const activeTab = req.query.tab || (req.url.includes('#cart') ? 'cart' : 'profile');

    // Render the profile template with all data
    res.render("profile", {
      user,
      cart: processedCart,
      cartTotal,
      itemCount,
      cartSuccess,
      cartError,
      avatar: avatarBase64,
      locale: res.locals.locale,
      activeTab
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized: Invalid or expired token." });
    }

    console.error("Error retrieving user profile:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.post(
  "/upload-avatar",
  verifyTokenExceptLogin,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
      }

      // Check if avatar already exists → update or create
      const existingAvatar = await Avatar.findOne({ userId });

      if (existingAvatar) {
        existingAvatar.filename = req.file.originalname;
        existingAvatar.contentType = req.file.mimetype;
        existingAvatar.data = req.file.buffer;
        existingAvatar.uploadedAt = new Date();
        await existingAvatar.save();
      } else {
        await Avatar.create({
          userId,
          filename: req.file.originalname,
          contentType: req.file.mimetype,
          data: req.file.buffer,
        });
      }

      // Return JSON response with avatar URL
      return res.json({
        success: true,
        message: "Avatar uploaded successfully",
        avatarUrl: `/avatars/${userId}?t=${Date.now()}`, // Cache-busting URL
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

router.get("/avatars/:userId", async (req, res) => {
  try {
    const avatar = await Avatar.findOne({ userId: req.params.userId });
    if (!avatar || !avatar.data) {
      return res.status(404).send("Avatar not found");
    }

    res.set("Content-Type", avatar.contentType);
    res.send(avatar.data);
  } catch (error) {
    console.error("Error serving avatar:", error);
    res.status(500).send("Internal server error");
  }
});

// Add new endpoint to view design
router.get("/cart-design/:index", verifyTokenExceptLogin, (req, res) => {
  try {
    const cart = req.session.cart || [];
    const index = parseInt(req.params.index);
    
    if (!cart[index] || !cart[index].options || !cart[index].options.design) {
      return res.status(404).send("Design not found");
    }

    // Get the base64 data
    const designData = cart[index].options.design;
    
    // Extract the content type and base64 data
    const matches = designData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      return res.status(400).send("Invalid design data");
    }

    const contentType = matches[1];
    const base64Data = matches[2];

    // Set the content type and send the image
    res.set('Content-Type', contentType);
    res.send(Buffer.from(base64Data, 'base64'));
  } catch (error) {
    console.error("Error serving design:", error);
    res.status(500).send("Internal server error");
  }
});

module.exports = router;
