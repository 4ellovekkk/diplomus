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
const validator = require("validator");



//routes import
const authRouter = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const prisma = new PrismaClient();




const privateKey = fs.readFileSync("server.key", "utf8");
const certificate = fs.readFileSync("server.pem", "utf8");
const ca = fs.readFileSync("server.pem", "utf8");


const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca,
    passphrase: "qwer",
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



//routes
app.use("/api", authRouter);
app.use("/api", orderRoutes);

//basic routes
app.get("/", (req, res) => {
    res.render("index");
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




https.createServer(credentials, app).listen(3000, () => {
    console.log('HTTPS Server running on port 443');
});