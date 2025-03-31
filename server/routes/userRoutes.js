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
        // Extract query parameters with defaults
        const {
            search = "",
            sort = "id",
            order = "asc",
            page = 1,
            limit = 10
        } = req.query;

        // Validate sort field to prevent SQL injection
        const validSortFields = ['id', 'username', 'email', 'role', 'is_locked'];
        const sortBy = validSortFields.includes(sort) ? sort : 'id';

        // Validate order direction
        const orderBy = order.toLowerCase() === 'desc' ? 'desc' : 'asc';

        // Calculate pagination values
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        // Build the query
        const whereCondition = search
            ? {
                OR: [
                    {username: {contains: search }},
                    {email: {contains: search}},
                    {role: {contains: search}}
                ]
            }
            : {};

        // Get total count for pagination info
        const totalUsers = await prisma.users.count({where: whereCondition});

        // Get paginated users
        const users = await prisma.users.findMany({
            where: whereCondition,
            orderBy: {[sortBy]: orderBy},
            skip: skip,
            take: limitNumber,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                is_locked: true,
                created_at: true
            }
        });

        // Transform users for the frontend
        const transformedUsers = users.map(user => ({
            ...user,
            status: user.is_locked ? 'Locked' : 'Active',
            created_at: user.created_at.toISOString().split('T')[0] // Format date
        }));

        // Return response with pagination info
        res.json({
            success: true,
            data: transformedUsers,
            pagination: {
                total: totalUsers,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(totalUsers / limitNumber)
            }
        });

    } catch (error) {
        console.error("Error retrieving users:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving users",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
        if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid user ID" });

        const { username, email, password, role } = req.body;
        const updateData = { username, email, role };

        if (password) {
            updateData.password_hash = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.users.update({
            where: { id },
            data: updateData
        });

        res.json({ success: true, user: updatedUser }); // Add success flag
    } catch (error) {
        handleError(res, error, "Error updating user");
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
        updatedUser.success=true;

        res.json(updatedUser);
    } catch (error) {
        handleError(res, error, "Error updating lock status");
    }
});



router.delete("/users/:id", verifyTokenExceptLogin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid user ID" });

        await prisma.users.delete({
            where: { id }
        });

        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        if (error.code === "P2025") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        handleError(res, error, "Error deleting user");
    }
});

module.exports = router;
