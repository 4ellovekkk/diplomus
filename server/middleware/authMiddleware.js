const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const allowedPaths = [
    "/api/login",
    "/auth/google",
    "/",
    "/api/register",
    "/auth/google/callback",
    "/services",
    "/about"
];

const verifyTokenExceptLogin = (req, res, next) => {
    // Skip token verification for /api/login
    if (allowedPaths.includes(req.path)) {
        return next();
    }
    // Get the token from the request headers, cookies, or query parameters
    const token = req.headers["authorization"] || req.cookies.token || req.query.token;

    if (!token) {
        return res.status(401).json({message: "Access denied. No token provided."});
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        // Optionally, you can check if the user exists in the database
        prisma.users.findUnique({where: {id: decoded.userId}})
            .then(user => {
                if (!user) {
                    return res.status(401).json({message: "User not found."});
                }
                next();
            })
            .catch(err => {
                return res.status(500).json({message: "Internal server error."});
            });
    } catch (err) {
        console.log(err);
        return res.status(400).json({message: "Invalid token."});
    }
};
module.exports = verifyTokenExceptLogin;