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
const printRoutes = require("./routes/printRoutes.js");
const checkoutRoutes = require("./routes/checkoutRoutes");
const passwordResetRoutes = require('./routes/passwordResetRoutes');

//additional imports
const app = express();
const prisma = new PrismaClient();
const Avatar = require("./models_mongo/avatar.js");
const Document = require("./models_mongo/documents.js");
const mongoose = require("mongoose");
async function connectToMongo() {
  try {
    await mongoose.connect("mongodb://localhost:27017/print_center");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1); // Stop the app if DB fails
  }
}
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
  updateFiles: false,
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
app.use((req, res, next) => {
  if (req.originalUrl === '/checkout/webhook') {
    express.raw({type: 'application/json'})(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use((req, res, next) => {
  if (req.originalUrl === '/checkout/webhook') {
    next();
  } else {
    express.urlencoded({ extended: true })(req, res, next);
  }
});

app.use(cookieParser());

// Set character encoding
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});

// Configure session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || ca,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true, // Required for HTTPS
      httpOnly: true,
      sameSite: 'strict'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));
app.use(verifyTokenExceptLogin);
app.use((req, res, next) => {
  const lang = req.cookies.locale || "en"; // Prefer cookie over query param
  req.setLocale(lang);
  res.locals.__ = req.__; // Make translation function available in views
  res.locals.locale = lang; // Make locale value available in views (for <html lang=""> and dropdowns)
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
app.use("/api", cartRoutes);
app.use("/api", userRoutes);
app.use("/api", serviceRoutes);
app.use("/", profileRoutes);
app.use("/", printRoutes);
app.use('/auth', passwordResetRoutes);
app.use("/checkout", checkoutRoutes);

//basic routes

connectToMongo();
app.get("/", async (req, res) => {
  try {
    const locale = req.getLocale();
    const translations = require(`./public/locales/${locale}.json`);

    // Check if token exists
    if (!req.cookies.token) {
      return res.render("index", { 
        user: null, 
        locale,
        translations,
        t: req.__
      });
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
      },
    });

    // Render with user and locale
    res.render("index", { 
      user, 
      locale,
      translations,
      t: req.__
    });
  } catch (error) {
    console.error("Error in root route:", error);

    // Clear invalid token
    res.clearCookie("token");

    // Render without user, but with locale support
    const locale = req.getLocale();
    const translations = require(`./public/locales/${locale}.json`);
    
    res.render("index", { 
      user: null, 
      locale,
      translations,
      t: req.__
    });
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
        errorTitle: res.__('access_denied'),
        errorMessage: res.__('access_denied_admin'),
        errorDetails: res.__('access_denied_details'),
        locale: req.getLocale()
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

    // Load translations for the current locale
    const translations = require(`./public/locales/${req.getLocale()}.json`);

    // Pass all necessary i18n variables to the view
    res.render("admin", {
      users,
      user: currentUser,
      i18n: {
        language: req.getLocale(),
        defaultLocale: i18n.getLocale(),
        languages: i18n.getLocales()
      },
      t: req.__,
      locale: req.getLocale(),
      translations
    });
  } catch (error) {
    console.error("Admin route error:", error);
    res.clearCookie("token");
    res.redirect("/login");
  }
});

app.get("/api/changelog", async (req, res) => {
  try {
    const {
      search = "",
      sort = "id",
      order = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const validSortFields = [
      "id",
      "userId",
      "field",
      "oldValue",
      "newValue",
      "changedBy",
      "changedAt",
    ];
    const sortBy = validSortFields.includes(sort) ? sort : "id";
    const orderBy = order.toLowerCase() === "asc" ? "asc" : "desc";
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const whereCondition = search
      ? {
          OR: [
            { field: { contains: search } },
            { oldValue: { contains: search } },
            { newValue: { contains: search } },
            ...(isNaN(search) ? [] : [
              { userId: parseInt(search) },
              { changedBy: parseInt(search) }
            ])
          ],
        }
      : {};

    const totalEntries = await prisma.changelog.count({
      where: whereCondition,
    });

    const changelog = await prisma.changelog.findMany({
      where: whereCondition,
      orderBy: { [sortBy]: orderBy },
      skip: skip || 0,
      take: limitNumber,
      select: {
        id: true,
        userId: true,
        field: true,
        oldValue: true,
        newValue: true,
        changedBy: true,
        changedAt: true,
        users_Changelog_changedByTousers: {
          select: {
            username: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: changelog,
      pagination: {
        total: totalEntries,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalEntries / limitNumber),
      },
      message: res.__('changelog_fetched_successfully')
    });
  } catch (err) {
    console.error("Error fetching changelog:", err);
    res.status(500).json({ 
      success: false,
      error: res.__('error_internal_server')
    });
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
          role: true,
        },
      });
    }
    res.render("about", { 
      user,
      locale: req.getLocale(),
      translations: require(`./public/locales/${req.getLocale()}.json`),
      t: req.__
    });
  } catch (error) {
    console.error("About route error:", error);
    res.clearCookie("token");
    res.render("about", { 
      user: null,
      locale: req.getLocale(),
      translations: require(`./public/locales/${req.getLocale()}.json`),
      t: req.__
    });
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
            username: email.split('@')[0],
            email,
            password_hash: "",
            role: "customer",
            is_locked: false,
          },
        });
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 3600000,
        sameSite: "none",
        secure: true,
      });
      res.redirect(301, "/profile");
    } catch (error) {
      console.error("Google OAuth error:", error);
      res.redirect("/login");
    }
  }
);
// Set user locale and redirect back
app.get("/set-locale", (req, res) => {
  const { lang, redirectTo } = req.query;

  if (!lang || !["en", "ru"].includes(lang)) {
    return res.status(400).render("error", {
      errorTitle: res.__('error_invalid_language'),
      errorMessage: res.__('error_invalid_language_message'),
      locale: req.getLocale()
    });
  }

  res.cookie("locale", lang, {
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "strict",
  });

  const redirectUrl = redirectTo || "/";
  res.redirect(redirectUrl);
});

// Forgot password page
app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { 
    locale: req.getLocale(),
    translations: require(`./public/locales/${req.getLocale()}.json`),
    t: req.__
  });
});

// Reset password page
app.get('/reset-password', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.redirect('/forgot-password');
  }
  
  res.render('reset-password', { 
    token,
    locale: req.getLocale(),
    translations: require(`./public/locales/${req.getLocale()}.json`),
    t: req.__
  });
});

https.createServer(credentials, app).listen(3000, () => {
  console.log("HTTPS Server running on port 3000");
});
