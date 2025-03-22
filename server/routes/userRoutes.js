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


// ---------------------- User Management Routes ----------------------

// Create a new user
router.post("/users", verifyTokenExceptLogin, async (req, res) => {
    try {
        const {username, email, password, role} = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({message: "All fields are required"});
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.users.create({
            data: {username, email, password_hash: hashedPassword, role: role || "customer"}
        });

        res.status(201).json(user);
    } catch (error) {
        handleError(res, error, "Error creating user");
    }
});

// Get all users
router.get("/users", verifyTokenExceptLogin, async (req, res) => {
    try {
        const {search, sortBy = "id", order = "asc"} = req.query;

        const users = await prisma.users.findMany({
            where: search
                ? {
                    OR: [
                        {username: {contains: search}},
                        {email: {contains: search}},
                        {role: {contains: search}}
                    ]
                }
                : undefined,
            orderBy: {[sortBy]: order.toLowerCase() === "desc" ? "desc" : "asc"}
        });

        res.json(users);
    } catch (error) {
        res.status(500).json({message: "Error retrieving users", error: error.message});
    }
});


// Get a single user by ID
router.get("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({message: "Invalid user ID"});

        const user = await prisma.users.findUnique({where: {id}});

        if (!user) return res.status(404).json({message: "User not found"});
        res.json(user);
    } catch (error) {
        handleError(res, error, "Error retrieving user");
    }
});

// Update a user by ID
router.put("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({message: "Invalid user ID"});

        const {username, email, password, role} = req.body;
        const updateData = {username, email, role};

        if (password) {
            updateData.password_hash = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.users.update({
            where: {id},
            data: updateData
        });

        res.json(updatedUser);
    } catch (error) {
        handleError(res, error, "Error updating user");
    }
});

// Delete a user by ID
router.delete("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({message: "Invalid user ID"});

        await prisma.users.delete({where: {id}});
        res.json({message: "User deleted successfully"});
    } catch (error) {
        handleError(res, error, "Error deleting user");
    }
});

// Lock or unlock a user
router.patch("/users/:id/lock", verifyTokenExceptLogin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({message: "Invalid user ID"});

        const user = await prisma.users.findUnique({where: {id}});
        if (!user) return res.status(404).json({message: "User not found"});

        const updatedUser = await prisma.users.update({
            where: {id},
            data: {is_locked: !user.is_locked}
        });

        res.json(updatedUser);
    } catch (error) {
        handleError(res, error, "Error updating lock status");
    }
});

module.exports = router;
