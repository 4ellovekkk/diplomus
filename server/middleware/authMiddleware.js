const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const i18n = require("i18n");
const path = require("path");

const prisma = new PrismaClient();

// Configure i18n
i18n.configure({
  locales: ["en", "ru"],
  directory: path.join(__dirname, "../public/locales"),
  defaultLocale: "en",
  cookie: "locale",
  autoReload: true,
  updateFiles: false,
});

const allowedPaths = [
  "/api/login",
  "/api/register",
  "/auth/google",
  "/",
  "/api/register",
  "/auth/google/callback",
  "/api/services",
  "/about",
  "/set-locale",
  "/print",
  "/copy",
  "/graphic-design",
  "/merch",
  "/api/print",
  "/api/copy",
  "/api/graphic-design",
  "/api/merch",
  "/api/get-file-info",
  "/webhook",
  "/checkout/webhook",
  "/forgot-password",
  "/reset-password",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-reset-token",
  "/login"
];

const verifyTokenExceptLogin = (req, res, next) => {
  // Get locale from cookie or default to 'en'
  const locale = req.cookies?.locale || 'en';
  
  // Set locale for this request
  req.setLocale(locale);
  res.locals.__ = req.__;
  res.locals.locale = locale;

  // Allow access to static files
  if (req.path.startsWith('/styles/') || 
      req.path.startsWith('/images/') || 
      req.path.startsWith('/js/') ||
      req.path.startsWith('/favicon')) {
    return next();
  }

  // Check if the path is in allowed paths
  const isAllowedPath = allowedPaths.some(path => req.path === path);
  
  // Special handling for checkout/success with session_id
  const isCheckoutSuccess = req.path === '/checkout/success' && req.query.session_id;
  
  if (isAllowedPath || isCheckoutSuccess) {
    return next();
  }

  const token = req.headers["authorization"] || req.cookies.token || req.query.token;

  if (!token) {
    // For API routes, return JSON response
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      return res.status(401).json({
        success: false,
        message: res.__('error_authentication_required')
      });
    }
    // For regular routes, render error page
    return res.status(401).render("error", {
      errorTitle: res.__('error_authentication_required'),
      errorMessage: res.__('error_please_login'),
      errorDetails: { code: 401, info: res.__('error_missing_token') },
      locale
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    prisma.users
      .findUnique({ where: { id: decoded.userId } })
      .then((user) => {
        if (!user) {
          // For API routes, return JSON response
          if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
            return res.status(401).json({
              success: false,
              message: res.__('error_user_not_found')
            });
          }
          // For regular routes, render error page
          return res.status(401).render("error", {
            errorTitle: res.__('error_user_not_found'),
            errorMessage: res.__('error_no_user_for_token'),
            errorDetails: { code: 401, userId: decoded.userId },
            locale
          });
        }
        next();
      })
      .catch((err) => {
        console.error("Database error:", err);
        // For API routes, return JSON response
        if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
          return res.status(500).json({
            success: false,
            message: res.__('error_internal_server')
          });
        }
        // For regular routes, render error page
        return res.status(500).render("error", {
          errorTitle: res.__('error_internal_server'),
          errorMessage: res.__('error_validate_user'),
          errorDetails: { code: 500, error: err.message },
          locale
        });
      });
  } catch (err) {
    console.error("JWT verification error:", err);
    // For API routes, return JSON response
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      return res.status(401).json({
        success: false,
        message: res.__('error_invalid_token')
      });
    }
    // For regular routes, render error page
    return res.status(400).render("error", {
      errorTitle: res.__('error_invalid_token'),
      errorMessage: res.__('error_token_verification'),
      errorDetails: { code: 400, error: err.message },
      locale
    });
  }
};

module.exports = verifyTokenExceptLogin;
