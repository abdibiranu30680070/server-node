const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ======================
// User Operations
// ======================

const createUser = async (email, name, password, role = "user") => {
  return prisma.user.create({
    data: { email, name, password, role },
  });
};

const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, password: true },
  });
};

const findUserById = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
};

const getAllUsers = async () => {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
};

const updateUserRole = async (userId, newRole) => {
  return prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, email: true, role: true },
  });
};

const deleteUser = async (userId) => {
  return prisma.user.delete({
    where: { id: userId },
  });
};

// ======================
// Patient Operations
// ======================

const getAllPatientsOfUser = async (userId) => {
  return prisma.patient.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      prediction: true,
      precentage: true,
      createdAt: true,
    },
  });
};

const createPatient = async (patientData) => {
  return prisma.patient.create({
    data: patientData,
    select: { id: true, name: true, createdAt: true },
  });
};

const updatePatientStatus = async (patientId, predictionData) => {
  return prisma.patient.update({
    where: { id: patientId },
    data: {
      prediction: predictionData.prediction,
      precentage: predictionData.precentage,
    },
    select: { id: true, prediction: true, precentage: true },
  });
};

// ======================
// Admin Utilities
// ======================

const findAdminUsers = async () => {
  return prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, name: true },
  });
};
// Add this to your existing queries
// In database/queries.js
const updateUser = async (userId, updateData) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...updateData,
      resetTokenExpiry: updateData.resetTokenExpiry ? 
        new Date(updateData.resetTokenExpiry) : 
        null
    }
  });
};



module.exports = {
  // User exports
  createUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  updateUserRole,
  deleteUser,
  updateUser,
  // Patient exports
  getAllPatientsOfUser,
  createPatient,
  updatePatientStatus,
  
  // Admin exports
  findAdminUsers
};