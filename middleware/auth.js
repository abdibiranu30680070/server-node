// Add this at the very top
require('dotenv').config();
require("dotenv").config();
const jwt = require("jsonwebtoken");

// Secret key validation
const secretKey = process.env.TOKEN;
if (!secretKey) {
  throw new Error("TOKEN environment variable is not set!");
}

// auth.js
const generateToken = (user) => {
  console.log("Generating token for user:", user);
  return jwt.sign(
    {
      userId: user.userId,  // Key matches your controller's usage
      email: user.email,
      role: user.role,
      username: user.name  // Add username here
    },
    secretKey,
    { expiresIn: "2h" }
  );
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Invalid authorization format" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, secretKey);
    console.log("Decoded Token:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid/Expired token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  res.status(403).json({ error: "Forbidden: Admins only" });
};

module.exports = { generateToken, authenticate, isAdmin };