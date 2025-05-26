const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
        message: 'Authentication required'
      });
    }
    // For regular routes, render error page
    return res.status(401).render("error", {
      errorTitle: "Authentication Required",
      errorMessage: "Please log in to continue",
      errorDetails: { code: 401, info: "Missing authentication token" },
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
              message: 'User not found'
            });
          }
          // For regular routes, render error page
          return res.status(401).render("error", {
            errorTitle: "User Not Found",
            errorMessage: "No user associated with this token.",
            errorDetails: { code: 401, userId: decoded.userId },
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
            message: 'Internal server error'
          });
        }
        // For regular routes, render error page
        return res.status(500).render("error", {
          errorTitle: "Internal Server Error",
          errorMessage: "Could not validate user from token.",
          errorDetails: { code: 500, error: err.message },
        });
      });
  } catch (err) {
    console.error("JWT verification error:", err);
    // For API routes, return JSON response
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    // For regular routes, render error page
    return res.status(400).render("error", {
      errorTitle: "Invalid Token",
      errorMessage: "JWT token could not be verified.",
      errorDetails: { code: 400, error: err.message },
    });
  }
};

module.exports = verifyTokenExceptLogin;
