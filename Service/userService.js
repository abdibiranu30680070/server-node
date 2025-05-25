require("dotenv").config();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const queries = require("../database/queries");
// const { sendPasswordResetEmail } = require('./emailService'); // Uncomment when you add email service

// ======================
// Validation
// ======================
const validateEmailAndPassword = (email, pass) => {
  if (!email || !email.includes("@")) return false;
  if (!pass || pass.length < 8) return false;
  return true;
};

// ======================
// User Auth Logic
// ======================
const checkIfFound = async (email) => {
  const user = await queries.findUserByEmail(email);
  return user || null;
};

const registerUser = async (email, name, pass, requesterRole = "user", role = "user") => {
  if (role === "admin" && requesterRole !== "admin") {
    throw new Error("Admin privileges required to create admin accounts");
  }

  const encryptedPassword = await bcrypt.hash(pass, 10);
  return queries.createUser(email, name, encryptedPassword, role);
};

const verifyPassword = async (enteredPassword, storedHash) => {
  return bcrypt.compare(enteredPassword, storedHash);
};

// ======================
// Admin Utilities
// ======================
const getAllUsers = async () => {
  return queries.getAllUsers();
};

const updateUserRole = async (userId, newRole, adminId) => {
  const admin = await queries.findUserById(adminId);
  if (admin.id === userId && newRole !== "admin") {
    throw new Error("Admins cannot demote themselves");
  }
  return queries.updateUserRole(userId, newRole);
};

const deleteUser = async (userId) => {
  return queries.deleteUser(userId);
};

// ======================
// Password Reset Logic
// ======================
const initiatePasswordReset = async (email) => {
  try {
    const user = await checkIfFound(email);
    if (!user) throw new Error("User not found");

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await queries.updateUser(user.id, {
      resetToken: await bcrypt.hash(resetToken, 10),
      resetTokenExpiry: resetTokenExpiry
    });

    // Send email (placeholder)
    // await sendPasswordResetEmail(email, resetToken);

    return {
      message: "Password reset initiated",
      resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined
    };
  } catch (error) {
    throw new Error(`Password reset initiation failed: ${error.message}`);
  }
};

const verifyPasswordResetToken = async (token, email) => {
  try {
    const user = await checkIfFound(email);
    if (!user) throw new Error("User not found");
    if (!user.resetToken || !user.resetTokenExpiry) throw new Error("Invalid reset token");
    if (Date.now() > new Date(user.resetTokenExpiry)) throw new Error("Reset token has expired");

    const isValidToken = await bcrypt.compare(token, user.resetToken);
    if (!isValidToken) throw new Error("Invalid reset token");

    return true;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

const updateUserPassword = async (email, newPassword) => {
  try {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const user = await checkIfFound(email);
    if (!user) throw new Error("User not found");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await queries.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    });

    return { message: "Password updated successfully" };
  } catch (error) {
    throw new Error(`Password update failed: ${error.message}`);
  }
};

// ======================
// Exports
// ======================
module.exports = {
  validateEmailAndPassword,
  checkIfFound,
  registerUser,
  verifyPassword,
  getAllUsers,
  updateUserRole,
  deleteUser,
  initiatePasswordReset,
  verifyPasswordResetToken,
  updateUserPassword
};
