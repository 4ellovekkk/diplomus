const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const CryptoJS = require('crypto-js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Debug: Log email configuration (without showing full credentials)
console.log('Email Configuration:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 3) + '...' : 'not set'
});

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('ERROR: SMTP credentials are not properly set in environment variables!');
}

// Create transporter using SMTP
const createTransporter = async () => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.yandex.ru',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        ciphers: 'SSLv3', // helps with compatibility
        rejectUnauthorized: false
      }
    });

    await transporter.verify();
    console.log('SMTP Transporter verified successfully');

    return transporter;
  } catch (error) {
    console.error('Error creating SMTP transporter:', error);
    throw error;
  }
};



// Generate reset token
function generateResetToken(email) {
  const timestamp = new Date().getTime();
  const data = `${email}-${timestamp}`;
  return CryptoJS.AES.encrypt(data, process.env.JWT_SECRET).toString();
}

// Verify reset token
function verifyResetToken(token) {
  try {
    const decrypted = CryptoJS.AES.decrypt(token, process.env.JWT_SECRET).toString(CryptoJS.enc.Utf8);
    const [email, timestamp] = decrypted.split('-');
    const tokenAge = new Date().getTime() - parseInt(timestamp);
    
    // Token expires after 1 hour (3600000 milliseconds)
    if (tokenAge > 3600000) {
      return null;
    }
    
    return email;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const userLang = req.getLocale() || 'en'; // Get user's language preference, default to English
    
    // Find user by email
    const user = await prisma.users.findFirst({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: userLang === 'ru' ? 
          'Аккаунт с таким email адресом не найден.' : 
          'No account found with that email address.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken(email);
    
    // Create reset URL
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    
    // Email content based on language
    const emailContent = {
      ru: {
        subject: 'Запрос на сброс пароля',
        html: `
          <h1>Запрос на сброс пароля</h1>
          <p>Вы запросили сброс пароля. Нажмите на ссылку ниже, чтобы сбросить пароль:</p>
          <a href="${resetUrl}">Сбросить пароль</a>
          <p>Эта ссылка действительна в течение 1 часа.</p>
          <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
        `
      },
      en: {
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      }
    };

    const selectedLanguage = emailContent[userLang] || emailContent.en;
    
    // Email options
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}@yandex.ru>`,
      to: email,
      subject: selectedLanguage.subject,
      html: selectedLanguage.html
    };

    // Get transporter and send email
    const transporter = await createTransporter();
    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: userLang === 'ru' ? 
        'Ссылка для сброса пароля отправлена на ваш email.' : 
        'Password reset link has been sent to your email.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    const errorMessage = req.getLocale() === 'ru' ? 
      'Ошибка при отправке письма для сброса пароля.' : 
      'Error sending password reset email.';
      
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Verify token and get email
    const email = verifyResetToken(token);
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.'
      });
    }

    // Find user by email
    const user = await prisma.users.findFirst({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Hash new password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await prisma.users.update({
      where: { id: user.id },
      data: { password_hash: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password has been successfully reset.'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password.'
    });
  }
});

// Verify reset token route
router.get('/verify-reset-token', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Reset token is required.'
    });
  }

  const email = verifyResetToken(token);
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token.'
    });
  }

  res.json({
    success: true,
    message: 'Valid reset token.'
  });
});

module.exports = router; 