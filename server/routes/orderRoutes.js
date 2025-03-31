const express = require('express');
const router = express.Router();
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
// Dummy user data (replace with database data)
// Profile route
router.get('/profile', (req, res) => {
    const token = req.headers["authorization"] || req.cookies.token || req.query.token;
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    // Optionally, you can check if the user exists in the database
    const userData = prisma.users.findUnique({where: {id: decoded.userId}})
        .then(user => {
            if (!user) {
                return res.status(401).json({message: "User not found."});
            }
            next();
        })
        .catch(err => {
            return res.status(500).json({message: "Internal server error."});
        });
    res.render('profile', {user: userData});
});

module.exports = router;
