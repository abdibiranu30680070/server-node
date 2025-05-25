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


/**
 * Calls the Python Flask API to predict diabetes.
 * @param {Object} patientData - The patient's health data.
 * @returns {Promise<Object>} - The prediction result from the Flask API.
 */
async function callPythonService(patientData) {
  if (!patientData) {
    throw new Error("Patient data is required.");
  }

  try {
    console.log("📤 Sending data to Python API:", JSON.stringify(patientData, null, 2));

    const response = await axios.post('https://phyton-service-1.onrender.com/predict', patientData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // 10 seconds timeout
    });

    if (!response.data) {
      throw new Error("Python service returned empty response");
    }

    console.log("✅ Received response from Python API:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error("❌ Error communicating with Python API:");
    console.error("Error message:", error.message);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error("Status code:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received. Request:", error.request);
    } else {
      // Something happened in setting up the request
      console.error("Request setup error:", error.message);
    }
    
    throw new Error(`Failed to get a response from Python service: ${error.message}`);
  }
}

module.exports = {
  createUser,
  findUserByEmail,
  getAllPatients,
  createPatient,
  callPythonService,
};
