const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

const verifyTokenExceptLogin = (req, res, next) => {
    // Skip token verification for /api/login
    if  ((req.path === "/api/login") || (req.path === "/auth/google") || (req.path === "/") || (req.path === "/api/register")||("/auth/google/callback")) {
        return next();
    }
    // Get the token from the request headers, cookies, or query parameters
    const token = req.headers["authorization"] || req.cookies.token || req.query.token;

    if (!token) {
        return res.status(401).json({message: "Access denied. No token provided."});
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, "lexa");
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