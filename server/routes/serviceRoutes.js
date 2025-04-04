const express = require("express");
const jwt = require("jsonwebtoken");
const {PrismaClient} = require("@prisma/client");
const bcrypt = require("bcryptjs");
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const libre = require('libreoffice-convert');
const upload = multer({ dest: 'uploads/' });


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
router.get("/print",verifyTokenExceptLogin, async (req, res) => {
    res.render("printing", {user: null});
})

const convertToPdf = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        const fileBuffer = fs.readFileSync(inputPath);
        libre.convert(fileBuffer, '.pdf', undefined, (err, done) => {
            if (err) {
                return reject(err);
            }
            fs.writeFileSync(outputPath, done);
            resolve(outputPath);
        });
    });
};

router.post('/get-file-info', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let pageCount = null;
    let convertedFilePath = null;

    try {
        if (fileExt === '.pdf') {
            const data = await pdfParse(fs.readFileSync(filePath));
            pageCount = data.numpages;
        } else if (fileExt === '.docx' || fileExt === '.doc') {
            convertedFilePath = filePath + '.pdf';
            await convertToPdf(filePath, convertedFilePath);
            const data = await pdfParse(fs.readFileSync(convertedFilePath));
            pageCount = data.numpages;
        } else {
            pageCount = 'Unknown (unsupported format)';
        }
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).json({ error: 'Error processing file' });
    } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Delete original file
    if (convertedFilePath && fs.existsSync(convertedFilePath)) fs.unlinkSync(convertedFilePath); // Delete converted file
}

    res.json({
        fileName: req.file.originalname,
        fileSize: (req.file.size / 1024).toFixed(2) + ' KB',
        pages: pageCount
    });
});

router.get("/copy",async (req, res) => {
    res.render("copy");
})

router.get("/merch",verifyTokenExceptLogin, async (req, res) => {
    const text = req.query.text || ''; // Example text from query params or use default
    const textColor = req.query.textColor || '#000000'; // Default black color
    const fontSize = req.query.fontSize || 20; // Default font size
    res.render("merch",{text: text, fontSize: fontSize,textColor: textColor});
})

module.exports = router;