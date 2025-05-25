const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Adjust path to your user model
const nodemailer = require("nodemailer");

// POST /forgot-password
router.post("/", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found with that email." });
    }

    const password = user.password; // ⚠️ Assuming you store plaintext (not recommended)

    // Configure nodemailer (use your email service)
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: "your-email@gmail.com",
        pass: "your-email-password", // Use app password if using Gmail
      },
    });

    const mailOptions = {
      from: "your-email@gmail.com",
      to: email,
      subject: "Your Account Password",
      text: `Hello,\n\nYour password is: ${password}\n\nPlease keep it secure.`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Password sent to email." });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Server error while sending password email." });
  }
});

module.exports = router;
