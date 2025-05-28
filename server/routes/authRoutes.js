const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

// Error handling middleware
const handleError = (
  res,
  error,
  titleKey = "error_occurred",
  messageKey = "error_something_wrong",
  status = 500,
) => {
  console.error(`${titleKey}:`, error);
  res.status(status).render("error", {
    errorTitle: res.__?.(titleKey) || titleKey,
    errorMessage: res.__?.(messageKey) || messageKey,
    errorDetails: { code: status, error: error.message },
  });
};

// ---------------------- Registration & Authentication ----------------------

// Render registration page
router.get("/register", (req, res) => {
  res.render("register");
});

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).render("error", {
        errorTitle: res.__("error_missing_fields"),
        errorMessage: res.__("error_all_fields_required"),
        errorDetails: { code: 400 },
      });
    }

    // Check if a user with the same username or email exists
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [{ username: username }, { email: email }],
      },
    });

    if (existingUser) {
      return res.status(409).render("error", {
        errorTitle: res.__("error_user_exists"),
        errorMessage: res.__("error_user_exists_message"),
        errorDetails: { code: 409 },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        role: role || "customer",
        is_locked: false,
      },
    });

    res.status(201).redirect("/login");
  } catch (error) {
    handleError(res, error, "error_registration_failed", "error_creating_user");
  }
});

// Render login page
router.get("/login", (req, res) => {
  res.render("login");
});

// User login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).render("error", {
        errorTitle: res.__("error_missing_credentials"),
        errorMessage: res.__("error_credentials_required"),
        errorDetails: { code: 400 },
      });
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).render("error", {
        errorTitle: res.__("error_invalid_credentials"),
        errorMessage: res.__("error_invalid_credentials_message"),
        errorDetails: { code: 401 },
      });
    }

    if (user.is_locked) {
      return res.status(403).render("error", {
        errorTitle: res.__("error_account_locked"),
        errorMessage: res.__("error_account_locked_message"),
        errorDetails: { code: 403 },
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 3600000,
      sameSite: "strict",
    });
    res.redirect(301, "/");
  } catch (error) {
    handleError(res, error, "error_login_failed", "error_login_failed_message");
  }
});

// Logout user
router.get("/logout", (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "strict",
    });
    res.render("logout");
  } catch (error) {
    handleError(res, error, "error_logout_failed", "error_logout_failed_message");
  }
});

module.exports = router;
