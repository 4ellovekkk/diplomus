const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const CryptoJS = require('crypto-js');
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

// Debug: Log email configuration (without showing full credentials)
console.log('Email Configuration:', {
  user: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 3) + '...' : 'not set',
  pass: process.env.EMAIL_APP_PASSWORD ? 'set (length: ' + process.env.EMAIL_APP_PASSWORD.length + ')' : 'not set'
});

if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  console.error('ERROR: Email credentials are not properly set in environment variables!');
}

// Configure OAuth2 client with the same credentials used for login
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials including refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Create async function to get access token
async function getAccessToken() {
  try {
    const { token } = await oauth2Client.getAccessToken();
    return token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Create transporter using OAuth2
const createTransporter = async () => {
  try {
    // Log OAuth2 configuration for debugging
    console.log('OAuth2 Configuration:', {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN ? 'Set' : 'Not set'
    });

    // Get new access token
    const accessToken = await oauth2Client.getAccessToken();
    console.log('Access Token Retrieved:', !!accessToken.token);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'diplomservice724@gmail.com',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken.token
      }
    });

    // Verify the transporter configuration
    await transporter.verify();
    console.log('Transporter verified successfully');
    
    return transporter;
  } catch (error) {
    console.error('Error creating transporter:', error);
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      console.error('GOOGLE_REFRESH_TOKEN is not set in environment variables');
    }
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
    
    // Find user by email
    const user = await prisma.users.findFirst({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken(email);
    
    // Create reset URL
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    
    // Email content
    const mailOptions = {
      from: {
        name: 'Diplom Service',
        address: 'diplomservice724@gmail.com'
      },
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    // Get transporter and send email
    const transporter = await createTransporter();
    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Password reset link has been sent to your email.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending password reset email.',
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