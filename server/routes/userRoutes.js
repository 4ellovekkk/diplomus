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
  const acceptsHTML = req.headers.accept && req.headers.accept.includes('text/html');

  if (acceptsHTML) {
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
    console.log(req.params);
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
    console.log(user);
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
);
router.put(
  "/users/:id",
  verifyTokenExceptLogin,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const changerId = decoded.userId; // who is making the change
      const userId = parseInt(req.params.id);

      const { username, email, password, role, name, phone, adress, goodleId } =
        req.body;

      const updateData = {
        username,
        email,
        role,
        name,
        phone,
        adress,
        goodleId,
      };

      // Get original user from DB
      const originalUser = await prisma.users.findUnique({
        where: { id: userId },
      });

      // If password provided, hash it
      if (password) {
        updateData.password_hash = await bcrypt.hash(password, 10);
      }

      // Update user
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: updateData,
      });

      // Compare and log changes
      const changeLogs = [];

      for (const key in updateData) {
        const oldValue = originalUser[key];
        const newValue = updateData[key];

        // Only log if value has changed and isn't null/undefined
        if (oldValue != newValue && newValue !== undefined) {
          changeLogs.push({
            userId: userId,
            field: key,
            oldValue: oldValue ? String(oldValue) : "",
            newValue: String(newValue),
            changedBy: changerId,
          });
        }
      }
      console.log(changeLogs);
      // Save change logs
      if (changeLogs.length > 0) {
        await prisma.Changelog.createMany({ data: changeLogs });
      }

      // Save avatar if uploaded
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
);
router.post("/users/:id/lock", verifyTokenExceptLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });
    const { is_locked } = req.body;
    console.log(is_locked);
    const updatedUser = await prisma.users.update({
      where: { id },
      data: { is_locked },
    });
    console.log(updatedUser);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    handleError(res, error, "Error updating lock status");
  }
});

router.post(
  "/users/:id/toggle-lock",
  verifyTokenExceptLogin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // First get the current user
      const user = await prisma.users.findUnique({
        where: { id },
        select: { 
          is_locked: true,
          role: true,
          goodleId: true 
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent locking admin users
      if (user.role === "admin") {
        return res.status(403).json({ 
          message: "Cannot lock admin users",
          success: false 
        });
      }

      // Toggle the lock status
      const updatedUser = await prisma.users.update({
        where: { id },
        data: { is_locked: !user.is_locked },
      });

      // Log the change
      await prisma.Changelog.create({
        data: {
          userId: id,
          field: "is_locked",
          oldValue: String(user.is_locked),
          newValue: String(!user.is_locked),
          changedBy: req.user.userId,
        },
      });

      res.json({
        success: true,
        user: updatedUser,
        message: `User account ${updatedUser.is_locked ? "locked" : "unlocked"} successfully`,
      });
    } catch (error) {
      console.error("Error toggling user lock:", error);
      res.status(500).json({
        success: false,
        message: "Error toggling user lock status",
      });
    }
  },
);

// Delete a user
router.delete("/users/:id", verifyTokenExceptLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return handleError(
        req,
        res,
        new Error("Invalid ID"),
        "Invalid Input",
        "User ID must be a number",
        400
      );
    }

    // Check if user exists before deleting
    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) {
      return handleError(
        req,
        res,
        new Error("User not found"),
        "Not Found",
        "User not found",
        404
      );
    }

    try {
      await prisma.users.delete({ where: { id } });
      res.json({ success: true, message: "User deleted successfully" });
    } catch (deleteError) {
      // Check if error is due to foreign key constraint
      if (deleteError.code === 'P2003') {
        return handleError(
          req,
          res,
          deleteError,
          "Cannot Delete User",
          "This user cannot be deleted because they have existing orders. Please delete or reassign their orders first.",
          400
        );
      }
      throw deleteError; // Re-throw if it's a different error
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    handleError(
      req,
      res,
      error,
      "Error deleting user",
      "Failed to delete user",
      500
    );
  }
});

module.exports = router;
