const express = require("express");
const https = require("https");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const path = require("path");
const cookieParser = require("cookie-parser");
const verifyTokenExceptLogin = require("./middleware/authMiddleware")

//routes import
const authRouter = require("./routes/authRoutes");

const app = express();

const privateKey = fs.readFileSync("server.key", "utf8");
const certificate = fs.readFileSync("server.pem", "utf8");
const ca = fs.readFileSync("server.pem", "utf8");

const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca,
    passphrase: "qwer",
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


app.use(express.static(path.join(__dirname, "public")));
app.use(verifyTokenExceptLogin);
app.use(cookieParser());

//routes
app.use("/api",authRouter);

app.get("/", verifyTokenExceptLogin, (req, res) => {
    res.redirect("/api/login");
})


https.createServer(credentials, app).listen(3000, () => {
    console.log('HTTPS Server running on port 443');
});