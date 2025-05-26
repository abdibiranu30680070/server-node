const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require('axios');

/**
 * Creates a new user in the database.
 * @param {string} email - User's email.
 * @param {string} name - User's name.
 * @param {string} password - Hashed password.
 * @returns {Promise<Object>} - The created user record.
 */
async function createUser(email, name, password) {
  if (!email || !name || !password) {
    throw new Error("Email, name, and password are required.");
  }

  try {
    return await prisma.user.create({
      data: { email, name, password },
    });
  } catch (error) {
    console.error("❌ Error creating user:", error.message);
    throw new Error("Failed to create user.");
  }
}

/**
 * Finds a user by email.
 * @param {string} email - User's email.
 * @returns {Promise<Object|null>} - User record or null if not found.
 */
async function findUserByEmail(email) {
  try {
    return await prisma.user.findUnique({
      where: { email },
    });
  } catch (error) {
    console.error("❌ Error finding user by email:", error.message);
    throw new Error("Failed to find user.");
  }
}

/**
 * Retrieves all patients from the database.
 * @returns {Promise<Array>} - List of all patients.
 */
async function getAllPatients() {
  try {
    return await prisma.patient.findMany();
  } catch (error) {
    console.error("❌ Error retrieving patients:", error.message);
    throw new Error("Failed to fetch patients.");
  }
}

/**
 * Creates a new patient record.
 * @param {Object} patientData - Patient's data.
 * @param {string} userId - ID of the user associated with this patient.
 * @returns {Promise<Object>} - The created patient record.
 */
async function createPatient(patientData) {
  console.log("Patient Data:", patientData);
  
  if (!patientData || !patientData.userId) {
    console.error("❌ Missing patient data or user ID.");
    throw new Error("Patient data and userId are required.");
  }

  try {
    return await prisma.patient.create({
      data: {
        ...patientData, // Spread patient data
        userId: patientData.userId, // Ensure userId is passed correctly
      },
    });
  } catch (error) {
    console.error("❌ Error creating patient:", error.message);
    throw new Error("Failed to create patient.");
  }
}

// This function takes patient data, formats it properly, calls the Python Flask API, and returns the prediction result
const callPythonService = async (patientData) => {
  try {
    const response = await axios.post(
      'https://phyton-service-1.onrender.com/predict',
      patientData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000 // 8 second timeout
      }
    );

    if (!response.data) {
      throw new Error("Empty response from prediction service");
    }
    return response.data;

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error("Prediction service timeout - try again later");
    }
    throw new Error(`Prediction service error: ${error.response?.status || 'Service unavailable'}`);
  }
};



/**
 * Calls the Python Flask API to predict diabetes.
 * @param {Object} patientData - The patient's health data.
 * @returns {Promise<Object>} - The prediction result from the Flask API.
 */
// services/appService.js or wherever callPythonService is defined


module.exports = {
  createUser,
  findUserByEmail,
  getAllPatients,
  createPatient,
  callPythonService,
};
