const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");
const fs = require("fs");
const libre = require("libreoffice-convert");
const upload = multer({ dest: "uploads/" });

const prisma = new PrismaClient();
const router = express.Router();
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

const convertToPdf = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(inputPath);
    libre.convert(fileBuffer, ".pdf", undefined, (err, done) => {
      if (err) {
        return reject(err);
      }
      fs.writeFileSync(outputPath, done);
      resolve(outputPath);
    });
  });
};

const handleError = (
  req,
  res,
  error,
  title = "Error",
  message = "Something went wrong",
  status = 500,
) => {
  console.error(title, error);
  const wantsHTML = req.accepts("html");

  if (wantsHTML) {
    res.status(status).render("error", {
      errorTitle: title,
      errorMessage: message,
      errorDetails: { code: status, error: error.message },
    });
  } else {
    res.status(status).json({
      success: false,
      message,
      error: error.message,
    });
  }
};

router.get("/services", async (req, res) => {
  try {
    let user = null;
    if (req.cookies?.token) {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
        },
      });
    }
    res.render("services", { user });
  } catch (error) {
    res.clearCookie("token");
    handleError(
      req,
      res,
      error,
      "Services Error",
      "Failed to load services page",
    );
  }
});

router.get("/print", verifyTokenExceptLogin, async (req, res) => {
  try {
    res.render("printing", { user: null });
  } catch (error) {
    handleError(
      req,
      res,
      error,
      "Printing Error",
      "Failed to load printing page",
    );
  }
});

router.post("/get-file-info", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return handleError(
      req,
      res,
      new Error("No file uploaded"),
      "Upload Error",
      "Please upload a document",
      400,
    );
  }

  const filePath = req.file.path;
  const fileExt = path.extname(req.file.originalname).toLowerCase();
  let pageCount = null;
  let convertedFilePath = null;

  try {
    if (fileExt === ".pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      pageCount = data.numpages;
    } else if (fileExt === ".docx" || fileExt === ".doc") {
      convertedFilePath = filePath + ".pdf";
      await convertToPdf(filePath, convertedFilePath);
      const data = await pdfParse(fs.readFileSync(convertedFilePath));
      pageCount = data.numpages;
    } else {
      pageCount = "Unknown (unsupported format)";
    }

    res.json({
      fileName: req.file.originalname,
      fileSize: (req.file.size / 1024).toFixed(2) + " KB",
      pages: pageCount,
    });
  } catch (error) {
    handleError(
      req,
      res,
      error,
      "File Processing Error",
      "Failed to analyze uploaded document",
    );
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (convertedFilePath && fs.existsSync(convertedFilePath))
      fs.unlinkSync(convertedFilePath);
  }
});

router.get("/copy", async (req, res) => {
  try {
    res.render("copy");
  } catch (error) {
    handleError(
      req,
      res,
      error,
      "Copy Service Error",
      "Failed to load copy page",
    );
  }
});

router.get("/merch", verifyTokenExceptLogin, async (req, res) => {
  try {
    const text = req.query.text || "";
    const textColor = req.query.textColor || "#000000";
    const fontSize = req.query.fontSize || 20;

    res.render("merch", { text, fontSize, textColor });
  } catch (error) {
    handleError(
      req,
      res,
      error,
      "Merch Error",
      "Failed to load merch designer",
    );
  }
});
module.exports = router;

