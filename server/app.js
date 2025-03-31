const express = require("express");
const https = require("https");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const path = require("path");
const cookieParser = require("cookie-parser");
const passport = require('./config/passport');
const session = require('express-session');
const verifyTokenExceptLogin = require("./middleware/authMiddleware")
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
//routes import
const authRouter = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const userRoutes = require("./routes/userRoutes");
const app = express();
const prisma = new PrismaClient();

app.use(session({
    secret: "lexa",
    resave: false,
    saveUninitialized: true
}));




const privateKey = fs.readFileSync("server.key", "utf8");
const certificate = fs.readFileSync("server.pem", "utf8");
const ca = fs.readFileSync("server.pem", "utf8");


const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca,
    passphrase: process.env.SESSION_SECRET,
};



//set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));



//middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: ca
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));
app.use(verifyTokenExceptLogin);


passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "https://localhost:3000/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            done(null, profile);
        }
    )
);

//routes
app.use("/api", authRouter);
// app.use("/api", orderRoutes);
app.use("/api", cartRoutes);
app.use("/api", userRoutes);
//basic routes
app.get("/", (req, res) => {
    res.render("index",);
});
app.get(
    "/auth/google",
    passport.authenticate("google", {scope: ["profile", "email"]})
);
app.get("/admin", async (req, res) => {
    const users = await prisma.users.findMany();
    res.render("admin", {users});
});
app.get("/about", (req, res) => {
    res.render("about");
})
app.get("/services", (req, res) => {
    res.render("services");
})
app.get("/profile", verifyTokenExceptLogin, async (req, res) => {
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const user = await prisma.users.findUnique({
            where: { id: decoded.userId },
            include: { orders: true } // Include user's orders
        });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Retrieve cart from session (ensure it exists)
        const cart = req.session.cart || [];

        res.render("profile", { user, cart }); // Pass 'cart' to the template
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), async (req, res) => {
    try {
        const { displayName, emails } = req.user;
        const email = emails[0].value;

        // Check if the user already exists in the database
        let user = await prisma.users.findUnique({
            where: { email },
        });

        // If user does not exist, create a new user
        if (!user) {
            user = await prisma.users.create({
                data: {
                    username: displayName.replace(/\s/g, "").toLowerCase(),
                    email,
                    password_hash: "", // No password required for OAuth
                    role: "customer",
                    is_locked: false,
                },
            });
        }

        // Generate a JWT token
        const token = jwt.sign({ userId: user.id, role: user.role }, "lexa", { expiresIn: "1h" });

        console.log(token);
        // Set token in a cookie
        res.cookie("token", token, {
            httpOnly: true,
            maxAge: 3600000,
            sameSite: "strict",
        });

        res.redirect("/profile");
    } catch (error) {
        console.error("Google OAuth error:", error);
        res.redirect("/login");
    }
});



https.createServer(credentials, app).listen(3000, () => {
    console.log('HTTPS Server running on port 443');
});