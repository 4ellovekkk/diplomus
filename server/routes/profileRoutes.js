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

    // Retrieve the cart from session (fallback to empty array)
    const cart = req.session.cart || [];

    // Render the profile template with user, cart, and avatar image
    res.render("profile", {
      user,
      cart,
      avatar: avatarBase64,
      locale: res.locals.locale,
    });
    console.log(req.session.cart);
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid or expired token." });
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
