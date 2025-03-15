const express = require("express");
const https = require("https");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const path = require("path");
const cookieParser = require("cookie-parser");
const verifyToken = require("./middleware/authMiddleware")

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

router.get("/", verifyToken, (req, res) => {
})


https.createServer(credentials, app).listen(3000, () => {
    console.log('HTTPS Server running on port 443');
});