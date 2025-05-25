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
const callPythonService = async (patientData) => {
  console.log('Sending to Python service:', {
    data: patientData,
    url: 'https://python-service-1.onrender.com/predict'
  });

  try {
    const response = await axios.post(
      'https://python-service-1.onrender.com/predict',
      patientData,
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PYTHON_SERVICE_KEY}` // Add if needed
        }
      }
    );

    console.log('Python service response:', response.data);
    return response.data;

  } catch (error) {
    console.error('Python Service Error:', {
      code: error.code,
      message: error.message,
      response: error.response?.data,
      request: {
        url: error.config?.url,
        data: error.config?.data
      }
    });
    throw new Error('Prediction service unavailable. Please try again later.');
  }
};

/**
 * Calls the Python Flask API to predict diabetes.
 * @param {Object} patientData - The patient's health data.
 * @returns {Promise<Object>} - The prediction result from the Flask API.
 */


module.exports = {
  createUser,
  findUserByEmail,
  getAllPatients,
  createPatient,
  callPythonService,
};
