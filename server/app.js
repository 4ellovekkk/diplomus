const express = require("express");
const https = require("https");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const cookieParser = require("cookie-parser");
const passport = require("./config/passport");
const session = require("express-session");
const verifyTokenExceptLogin = require("./middleware/authMiddleware");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const i18n = require("i18n");
require("dotenv").config();
//routes import
const authRouter = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const userRoutes = require("./routes/userRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const profileRoutes = require("./routes/profileRoutes.js");

//additional imports
const app = express();
const prisma = new PrismaClient();
const Avatar = require("./models_mongo/avatar.js");
const mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:27017/print_center");

app.use(
  session({
    secret: "lexa",
    resave: false,
    saveUninitialized: true,
  }),
);

// Configure i18n
i18n.configure({
  locales: ["en", "ru"], // Supported languages
  directory: path.join(__dirname, "public/locales"), // Folder for translation files
  defaultLocale: "en",
  queryParameter: "lang", // Allow language switching via query param
  cookie: "locale", // Store user preference in cookies
  autoReload: true,
});

// Use i18n in Express
app.use(i18n.init);

const privateKey = fs.readFileSync("server.key", "utf8");
const certificate = fs.readFileSync("server.pem", "utf8");
const ca = fs.readFileSync("server.pem", "utf8");

const credentials = {
  key: privateKey,
  cert: certificate,
  ca: ca,
  passphrase: process.env.SESSION_SECRET,
};

//set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: ca,
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));
app.use(verifyTokenExceptLogin);
app.use((req, res, next) => {
  let lang = req.query.lang || req.cookies.locale || "en";
  req.setLocale(lang);
  res.locals.__ = req.__; // Make translations available in templates
  next();
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      done(null, profile);
    },
  ),
);

//routes
app.use("/api", authRouter);
// app.use("/api", orderRoutes);
app.use("/api", cartRoutes);
app.use("/api", userRoutes);
app.use("/", serviceRoutes);
app.use("/", profileRoutes);
//basic routes
app.get("/", async (req, res) => {
  try {
    // Check if token exists
    if (!req.cookies.token) {
      return res.render("index", { user: null });
    }

    // Verify token
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);

    // Find user in database
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        // Only select necessary fields
      },
    });

    // Render with user data
    res.render("index", { user });
  } catch (error) {
    console.error("Error in root route:", error);

    // Clear invalid token
    res.clearCookie("token");

    // Render without user data
    res.render("index", { user: null });
  }
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
// Admin route with authentication and authorization check
app.get("/admin", async (req, res) => {
  try {
    // Check authentication
    if (!req.cookies?.token) {
      return res.redirect("/login");
    }

    // Verify token and get user
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const currentUser = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
      },
    });

    // Check authorization (admin only)
    if (currentUser.role !== "admin") {
      return res.status(403).render("error", {
        errorTitle: "Access Denied",
        errorMessage: "Forbidden: Admin access required",
        errorDetails: "You are not permited to access this page",
      });
    }

    // Get all users for admin panel
    const users = await prisma.users.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        is_locked: true,
        created_at: true,
      },
    });

    res.render("admin", { users, user: currentUser });
  } catch (error) {
    console.error("Admin route error:", error);
    res.clearCookie("token");
    res.redirect("/login");
  }
});

// About route with optional user data
app.get("/about", async (req, res) => {
  try {
    let user = null;
    if (req.cookies?.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
        },
      });
    }
    res.render("about", { user });
  } catch (error) {
    console.error("About route error:", error);
    res.clearCookie("token");
    res.render("about", { user: null });
  }
});

// Services route with optional user data
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      const { displayName, emails } = req.user;
      const email = emails[0].value;

      // Check if the user already exists in the database
      let user = await prisma.users.findUnique({
        where: { email },
      });

      // If user does not exist, create a new user
      if (!user) {
        user = await prisma.users.create({
          data: {
            username: displayName.replace(/\s/g, "").toLowerCase(),
            email,
            password_hash: "", // No password required for OAuth
            role: "customer",
            is_locked: false,
          },
        });
      }

      // Generate a JWT token

      const token = jwt.sign({ userId: user.id, role: user.role }, "lexa", {
        expiresIn: "1h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 3600000,
        sameSite: "none", // Change from "strict" if cross-site
        secure: true, // Required if sameSite is none
      });
      res.redirect(301, "/profile");
    } catch (error) {
      console.error("Google OAuth error:", error);
      res.redirect("/login");
    }
  },
);

https.createServer(credentials, app).listen(3000, () => {
  console.log("HTTPS Server running on port 3000");
});
