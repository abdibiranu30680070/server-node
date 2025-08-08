require("dotenv").config();
const express = require("express");
const router = express.Router();
const userService = require("../Service/userService");
const nodemailer = require("nodemailer");

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    // 1️⃣ Initiate password reset and get reset token (only returns token in development)
    const result = await userService.initiatePasswordReset(email);
    const resetToken = result.resetToken;

    // 2️⃣ Configure Nodemailer transporter using environment variables
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 3️⃣ Compose password reset link
    const resetLink = `http://127.0.0.1:3000/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Instructions",
      text: `Hi,

Please click the link below to reset your password:
${resetLink}

If you did not request this, you can safely ignore this email.

Best regards,
Your App Team`,
    };

    // 4️⃣ Send the reset email
    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: "Password reset email sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: error.message || "Internal server error." });
  }
});

module.exports = router;
