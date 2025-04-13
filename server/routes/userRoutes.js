const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const Avatar = require("../models_mongo/avatar.js");
const prisma = new PrismaClient();
const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

const multer = require("multer");
const upload = multer(); // using memoryStorage for buffer access

const handleError = (
  req,
  res,
  error,
  title = "Error",
  message = "Something went wrong",
  status = 500,
) => {
  console.error(title, error);
  const wantsHTML = req.accepts("html");

  if (wantsHTML) {
    res.status(status).render("error", {
      errorTitle: title,
      errorMessage: message,
      errorDetails: { code: status, error: error.message },
    });
  } else {
    res.status(status).json({
      success: false,
      message,
      error: error.message,
    });
  }
};
// Create a new user
router.post("/users", verifyTokenExceptLogin, async (req, res) => {
  try {
    const { username, email, password, role, name, phone, adress, goodleId } =
      req.body;

    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return handleError(
        req,
        res,
        new Error("User already exists"),
        "Conflict",
        "A user with this username or email already exists",
        409,
      );
    }

    if (!username || !email || !password) {
      return handleError(
        req,
        res,
        new Error("Missing fields"),
        "Validation Error",
        "Username, email, and password are required",
        400,
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        role: role || "customer",
        name,
        phone,
        adress,
        goodleId,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    handleError(res, error, "Error creating user");
  }
});

// Get all users with filtering, sorting, and pagination
router.get("/users", verifyTokenExceptLogin, async (req, res) => {
  try {
    const {
      search = "",
      sort = "id",
      order = "asc",
      page = 1,
      limit = 10,
    } = req.query;

    const validSortFields = [
      "id",
      "username",
      "email",
      "role",
      "is_locked",
      "created_at",
    ];
    const sortBy = validSortFields.includes(sort) ? sort : "id";
    const orderBy = order.toLowerCase() === "desc" ? "desc" : "asc";

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const whereCondition = search
      ? {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
            { role: { contains: search } },
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const totalUsers = await prisma.users.count({ where: whereCondition });

    const users = await prisma.users.findMany({
      where: whereCondition,
      orderBy: { [sortBy]: orderBy },
      skip,
      take: limitNumber,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_locked: true,
        created_at: true,
        name: true,
        phone: true,
        adress: true,
        goodleId: true,
      },
    });

    res.json({
      success: true,
      data: users,
      pagination: {
        total: totalUsers,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalUsers / limitNumber),
      },
    });
  } catch (error) {
    handleError(req, res, error, "Error creating user");
  }
});

// Get a single user by ID
router.get("/users/:id", verifyTokenExceptLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return handleError(
        req,
        res,
        new Error("Invalid ID"),
        "Invalid Input",
        "User ID must be a number",
        400,
      );
    }

    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) {
      return handleError(
        req,
        res,
        new Error("User not found"),
        "Not Found",
        "User not found",
        404,
      );
    }
    res.json({ success: true, user });
  } catch (error) {
    handleError(res, error, "Error retrieving user");
  }
});

// Update a user by ID
router.put(
  "/users",
  verifyTokenExceptLogin,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      const { username, email, password, role, name, phone, adress, goodleId } =
        req.body;

      console.log(req.body);
      const updateData = {
        username,
        email,
        role,
        name,
        phone,
        adress,
        goodleId,
      };

      // Hash password if provided
      if (password) {
        updateData.password_hash = await bcrypt.hash(password, 10);
      }

      // 🌐 Update user info in SQL (Prisma)
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: updateData,
      });

      // 🖼️ Update avatar in MongoDB if file is uploaded
      if (req.file) {
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
      }

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating user:", error);
      handleError(req, res, error, "Error updating user");
    }
  },
); // Lock or unlock a user

router.patch("/users/:id/lock", verifyTokenExceptLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

    const { is_locked } = req.body;
    if (typeof is_locked !== "boolean") {
      return res.status(400).json({ message: "is_locked must be a boolean" });
    }

    const updatedUser = await prisma.users.update({
      where: { id },
      data: { is_locked },
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    handleError(res, error, "Error updating lock status");
  }
});

// Delete a user
router.delete("/users/:id", verifyTokenExceptLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });

    await prisma.users.delete({ where: { id } });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    handleError(res, error, "Error deleting user");
  }
});

module.exports = router;
