require("dotenv").config();
const express = require("express");
const router = express.Router();
const userService = require("../Service/userService");
const nodemailer = require("nodemailer");

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // 1️⃣ Initiate password reset and get reset token (dev only)
    const result = await userService.initiatePasswordReset(email);
    const resetToken = result.resetToken; // only returned in dev

    // 2️⃣ Configure Nodemailer
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER, // load from .env
        pass: process.env.EMAIL_PASS, // load from .env (App Password)
      },
    });

    // 3️⃣ Build reset link
    const resetLink = `http://127.0.0.1:3000/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Instructions",
      text: `Hi,\n\nPlease click the link below to reset your password:\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    };

    // 4️⃣ Send the email
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Password reset email sent." });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: error.message || "Internal server error." });
  }
});

module.exports = router;
