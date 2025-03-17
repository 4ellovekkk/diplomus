const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/login", async (req, res) => {
    res.render("login"); // Render the login.ejs file
})

router.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find the user by username or email
        const user = await prisma.users.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: username },
                ],
            },
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Compare the provided password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: "1h" } // Token expires in 1 hour
        );

        // Set the token in a cookie
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true, // Prevent client-side JavaScript from accessing the cookie
            secure: true, // Ensure the cookie is only sent over HTTPS
            maxAge: 3600000, // 1 hour in milliseconds
        });

        // Return success response
        res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Logout Route
router.post("/api/logout", (req, res) => {
    // Clear the auth cookie
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: true,
    });

    // Return success response
    res.status(200).json({ message: "Logout successful" });
});

module.exports = router;