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
      include: { orders: true }, // Include user's orders
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

    // Get cart data and fetch service details
    const cart = req.session.cart || [];
    const cartWithDetails = await Promise.all(
      cart.map(async (item) => {
        const service = await prisma.services.findUnique({
          where: { id: item.service_id },
        });
        return {
          ...item,
          service_description: service ? service.description : null
        };
      })
    );

    const { total: cartTotal, itemCount } = calculateCartTotals(cartWithDetails);

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
      cart: cartWithDetails,
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
module.exports = router;
