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
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
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

// Create Prisma client with connection management
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "sqlserver://localhost:1433;database=print_center;user=sa;password=MyPassword123#;trustServerCertificate=true"
    }
  },
  log: ['query', 'info', 'warn', 'error'],
});

// Database connection management
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Make prisma available globally
global.prisma = prisma;

const Avatar = require("./models_mongo/avatar.js");
const Document = require("./models_mongo/documents.js");
const mongoose = require("mongoose");
async function connectToMongo() {
  try {
    await mongoose.connect("mongodb://localhost:27017/print_center");
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
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

// Helper function to translate service names
function translateServiceName(serviceName, req) {
  if (!serviceName) return req.__('service_unknown') || 'Unknown Service';
  
  // Map service names to translation keys
  const serviceNameMap = {
    'Document Printing': 'service_document_printing',
    'Custom T-Shirt': 'service_custom_tshirt',
    'Unknown Service': 'service_unknown',
    'Logo Design': 'service_logo_design',
    'Branding': 'service_branding',
    'Social Media Graphics': 'service_social_media_graphics',
    'Print Materials': 'service_print_materials',
    'Graphic Design Consultation': 'service_graphic_design_consultation',
    'Custom merch design': 'service_custom_merch_design',
    'Custom Merch Design': 'service_custom_merch_design',
    'Photocopy': 'service_photocopy',
    'Printing': 'service_printing',
    'Merch Design': 'service_merch_design',
    'Xerox Copy Service': 'service_xerox_copy',
    'Merch': 'merch',
    'Grapic designer consultation': 'service_graphic_designer_consultation',
    'Graphic Designer Consultation': 'service_graphic_designer_consultation',
    'Unknown Product': 'service_unknown_product'
  };
  
  const translationKey = serviceNameMap[serviceName];
  return translationKey ? req.__(translationKey) : serviceName;
}

// Helper function to translate service descriptions
function translateServiceDescription(serviceName, originalDescription, req) {
  if (!serviceName) return originalDescription || '—';
  
  // Map service names to description translation keys
  const serviceDescriptionMap = {
    'Document Printing': 'service_description_document_printing',
    'Custom merch design': 'service_description_custom_merch_design',
    'Custom Merch Design': 'service_description_custom_merch_design',
    'Grapic designer consultation': 'service_description_graphic_designer_consultation',
    'Graphic Designer Consultation': 'service_description_graphic_designer_consultation',
    'Graphic Design Consultation': 'service_description_graphic_designer_consultation',
    'Unknown Product': 'service_description_unknown_product'
  };
  
  const translationKey = serviceDescriptionMap[serviceName];
  return translationKey ? req.__(translationKey) : (originalDescription || '—');
}

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

// Root route
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

// Google OAuth route
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

// Changelog API route
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
        users_Changelog_userIdTousers: {
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
  } catch (error) {
    console.error('Error fetching changelog:', error);
    res.status(500).json({
      success: false,
      message: res.__('error_fetching_changelog') || 'Error fetching changelog'
    });
  }
});

// Order Statistics API route
app.get("/api/order-statistics", async (req, res) => {
  try {
    // Check if user is logged in and is admin
    if (!req.cookies?.token) {
      return res.status(401).json({ 
        success: false, 
        message: res.__('unauthorized') || 'Unauthorized' 
      });
    }

    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: res.__('access_denied_admin') || 'Access denied: Admin required' 
      });
    }

    // Get date range from query parameters (default to last 30 days)
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch order statistics by service type
    const orderStats = await prisma.order_items.groupBy({
      by: ['service_id'],
      where: {
        created_at: {
          gte: startDate
        }
      },
      _count: {
        id: true
      },
      _sum: {
        quantity: true,
        subtotal: true
      }
    });

    // Get service details for each statistic and group them
    const serviceDetails = await Promise.all(
      orderStats.map(async (stat) => {
        const service = await prisma.services.findUnique({
          where: { id: stat.service_id },
          select: { name: true, description: true }
        });

        return {
          service_id: stat.service_id,
          original_service_name: service?.name || 'Unknown Service',
          service_name: translateServiceName(service?.name, req),
          service_description: translateServiceDescription(service?.name, service?.description, req),
          order_count: stat._count.id,
          total_quantity: stat._sum.quantity || 0,
          total_revenue: parseFloat(stat._sum.subtotal?.toString() || '0'),
          average_order_value: stat._count.id > 0 ? 
            parseFloat((stat._sum.subtotal / stat._count.id).toString()) : 0
        };
      })
    );

    // Group services into categories
    const groupedStatistics = [];
    const merchServices = [];
    const printServices = [];

    serviceDetails.forEach(stat => {
      // Check if this is a merch service using the original service name
      const isMerchService = 
        stat.original_service_name === 'Custom T-Shirt' || 
        stat.original_service_name === 'Unknown Service' || 
        stat.original_service_name === 'Unknown Product' ||
        stat.original_service_name.toLowerCase().includes('merch') || 
        stat.original_service_name.toLowerCase().includes('tshirt') ||
        stat.original_service_name.toLowerCase().includes('design');

      if (isMerchService) {
        merchServices.push(stat);
      } else {
        printServices.push(stat);
      }
    });

    // Combine merch services into one category
    if (merchServices.length > 0) {
      const totalMerchOrders = merchServices.reduce((sum, stat) => sum + stat.order_count, 0);
      const totalMerchQuantity = merchServices.reduce((sum, stat) => sum + stat.total_quantity, 0);
      const totalMerchRevenue = merchServices.reduce((sum, stat) => sum + stat.total_revenue, 0);
      const averageMerchOrderValue = totalMerchOrders > 0 ? totalMerchRevenue / totalMerchOrders : 0;

      groupedStatistics.push({
        service_id: 'merch',
        service_name: translateServiceName('Merch', req),
        service_description: 'Custom merchandise and design services',
        order_count: totalMerchOrders,
        total_quantity: totalMerchQuantity,
        total_revenue: totalMerchRevenue,
        average_order_value: averageMerchOrderValue
      });
    }

    // Add print services as individual categories
    printServices.forEach(stat => {
      // Skip Unknown Product as it's now grouped with merch
      if (stat.original_service_name !== 'Unknown Product') {
        groupedStatistics.push({
          service_id: stat.service_id,
          service_name: stat.service_name,
          service_description: stat.service_description,
          order_count: stat.order_count,
          total_quantity: stat.total_quantity,
          total_revenue: stat.total_revenue,
          average_order_value: stat.average_order_value
        });
      }
    });

    // Get overall statistics
    const totalOrders = await prisma.order_items.count({
      where: {
        created_at: {
          gte: startDate
        }
      }
    });

    const totalRevenue = await prisma.order_items.aggregate({
      where: {
        created_at: {
          gte: startDate
        }
      },
      _sum: {
        subtotal: true
      }
    });

    const overallStats = {
      total_orders: totalOrders,
      total_revenue: parseFloat(totalRevenue._sum.subtotal?.toString() || '0'),
      average_order_value: totalOrders > 0 ? 
        parseFloat((totalRevenue._sum.subtotal / totalOrders).toString()) : 0
    };

    res.json({
      success: true,
      data: {
        period_days: days,
        period_start: startDate,
        period_end: new Date(),
        service_statistics: groupedStatistics,
        overall_statistics: overallStats
      },
      message: res.__('order_statistics_fetched_successfully') || 'Order statistics fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({
      success: false,
      message: res.__('error_fetching_order_statistics') || 'Error fetching order statistics'
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

// Google OAuth callback
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

      // Check if user is locked
      if (user.is_locked) {
        return res.status(403).render("error", {
          errorTitle: res.__('error_account_locked'),
          errorMessage: res.__('error_account_locked_message'),
          errorDetails: { code: 403 },
          locale: req.getLocale()
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

// Initialize databases and start server
async function startServer() {
  try {
    // Connect to databases first
    await connectDatabase();
    await connectToMongo();
    
    // Start HTTPS server
    https.createServer(credentials, app).listen(3000, () => {
      console.log("✅ HTTPS Server running on port 3000");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();