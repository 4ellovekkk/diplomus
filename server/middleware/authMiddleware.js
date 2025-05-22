const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const allowedPaths = [
  "/api/login",
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
  "/api/get-file-info"
];

const verifyTokenExceptLogin = (req, res, next) => {
  if (allowedPaths.includes(req.path)) {
    return next();
  }

  const token =
    req.headers["authorization"] || req.cookies.token || req.query.token;

  if (!token) {
    return res.status(400).render("error", {
      errorTitle: "No Authorization Token",
      errorMessage:
        "There is no JWT token found in cookies, headers, or query. Are you authorized?",
      errorDetails: { code: 400, info: "Missing JWT token" },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    prisma.users
      .findUnique({ where: { id: decoded.userId } })
      .then((user) => {
        if (!user) {
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
        return res.status(500).render("error", {
          errorTitle: "Internal Server Error",
          errorMessage: "Could not validate user from token.",
          errorDetails: { code: 500, error: err.message },
        });
      });
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(400).render("error", {
      errorTitle: "Invalid Token",
      errorMessage: "JWT token could not be verified.",
      errorDetails: { code: 400, error: err.message },
    });
  }
};

module.exports = verifyTokenExceptLogin;
