const express = require("express");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
router.get("/services", async (req, res) => {
    try {
        let user = null;
        if (req.cookies?.token) {
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
            user = await prisma.users.findUnique({
                where: {id: decoded.userId},
                select: {
                    id: true,
                    username: true
                }
            });
        }
        res.render("services", {user});
    } catch (error) {
        console.error("Services route error:", error);
        res.clearCookie("token");
        res.render("services", {user: null});
    }
});

module.exports = router;