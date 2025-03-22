const express = require("express");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

// Error handling middleware
const handleError = (res, error, message = "An error occurred", status = 500) => {
    console.error(message, error);
    res.status(status).json({message, error: error.message});
};

// ---------------------- Registration & Authentication ----------------------

// Render registration page
router.get("/register", (req, res) => {
    res.render("register");
});

// Register a new user
router.post("/register", async (req, res) => {
    try {
        const {username, email, password, role} = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({message: "All fields are required"});
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.users.create({
            data: {
                username,
                email,
                password_hash: hashedPassword,
                role: role || "customer"
            }
        });

        res.status(201).json(user);
    } catch (error) {
        handleError(res, error, "Error creating user");
    }
});

// Render login page
router.get("/login", (req, res) => {
    res.render("login");
});

// User login
router.post("/login", async (req, res) => {
    try {
        const {identifier, password} = req.body; // Identifier can be email or username
        if (!identifier || !password) {
            return res.status(400).json({message: "Email/Username and password are required"});
        }

        const user = await prisma.users.findFirst({
            where: {
                OR: [
                    {email: identifier},
                    {username: identifier}
                ]
            }
        });

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({message: "Invalid email/username or password"});
        }

        if (user.is_locked) {
            return res.status(403).json({message: "Account is locked"});
        }

        const token = jwt.sign({userId: user.id, role: user.role}, "lexa", {expiresIn: "1h"});

        res.cookie("token", token, {
            httpOnly: true,
            maxAge: 3600000,
            sameSite: "strict"
        });
        res.redirect(301, "/");

        // res.json({message: "Logged in successfully"});
    } catch (error) {
        handleError(res, error, "Error logging in");
    }
});

// Logout user
router.get("/logout", (req, res) => {
    try {
        res.cookie("token", "", {
            httpOnly: true,
            expires: new Date(0),
            sameSite: "strict"
        });

        res.json({message: "Logged out successfully"});
    } catch (error) {
        handleError(res, error, "Error logging out");
    }
});

module.exports = router;
