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
  title = "An error occurred",
  message = "Something went wrong",
  status = 500,
) => {
  console.error(`${title}:`, error);
  res.status(status).render("error", {
    errorTitle: title,
    errorMessage: message,
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
        errorTitle: "Missing Fields",
        errorMessage: "All fields (username, email, password) are required.",
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
        errorTitle: "User Already Exists",
        errorMessage: "A user with the same username or email already exists.",
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

    res.status(201).redirect("/login"); // Or render a success page if needed
  } catch (error) {
    handleError(req, res, error, "Registration Failed", "Error creating user");
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
        errorTitle: "Missing Credentials",
        errorMessage: "Email/Username and password are required.",
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
        errorTitle: "Invalid Credentials",
        errorMessage: "Invalid email/username or password.",
        errorDetails: { code: 401 },
      });
    }

    if (user.is_locked) {
      return res.status(403).render("error", {
        errorTitle: "Account Locked",
        errorMessage: "Your account has been locked. Please contact support.",
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
    handleError(res, error, "Login Failed", "Error logging in");
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
    handleError(res, error, "Logout Failed", "Error logging out");
  }
});

module.exports = router;
