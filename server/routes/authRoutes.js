const express = require("express");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
const router = express.Router();
const bodyParser = require("body-parser");

// Middleware for authentication
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

// Register a new user
router.post("/users", async (req, res) => {
    try {
        const {username, email, password, role} = req.body;
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
        res.status(500).json({message: "Error creating user", error: error.message});
    }
});

router.get("/login", (req, res) => {
    res.render("login");
})

// Login route
router.post("/login", async (req, res) => {
    try {
        const {email, password} = req.body;
        console.log(email, password);
        const user = await prisma.users.findUnique({where: {email}});

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({message: "Invalid email or password"});
        }

        const token = jwt.sign({userId: user.id, role: user.role}, "your_jwt_secret_key", {expiresIn: "1h"});
        res.json({token});
    } catch (error) {
        res.status(500).json({message: "Error logging in", error: error.message});
    }
});

// Get all users
router.get("/users", verifyTokenExceptLogin, async (req, res) => {
    try {
        const users = await prisma.users.findMany();
        res.json(users);
    } catch (error) {
        res.status(500).json({message: "Error retrieving users", error: error.message});
    }
});

// Get a single user by ID
router.get("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        const user = await prisma.users.findUnique({
            where: {id: parseInt(req.params.id)}
        });

        if (!user) return res.status(404).json({message: "User not found"});
        res.json(user);
    } catch (error) {
        res.status(500).json({message: "Error retrieving user", error: error.message});
    }
});

// Update a user by ID
router.put("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        const {username, email, password, role} = req.body;
        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        const updatedUser = await prisma.users.update({
            where: {id: parseInt(req.params.id)},
            data: {
                username,
                email,
                password_hash: hashedPassword,
                role
            }
        });

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({message: "Error updating user", error: error.message});
    }
});

// Delete a user by ID
router.delete("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        await prisma.users.delete({
            where: {id: parseInt(req.params.id)}
        });
        res.json({message: "User deleted successfully"});
    } catch (error) {
        res.status(500).json({message: "Error deleting user", error: error.message});
    }
});

module.exports = router;
