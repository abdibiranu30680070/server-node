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
async function callPythonService(patientData) {
  // Validate input
  if (!patientData) {
    throw new Error("Patient data is required.");
  }

  try {
    // Prepare data in exact format Python service expects
    const formattedData = {
      Pregnancies: parseInt(patientData.Pregnancies, 10) || 0,
      Glucose: parseFloat(patientData.Glucose) || 0,
      BloodPressure: parseFloat(patientData.BloodPressure) || 0,
      SkinThickness: parseFloat(patientData.SkinThickness) || 0,
      Insulin: parseFloat(patientData.Insulin) || 0,
      BMI: parseFloat(patientData.BMI) || 0,
      DiabetesPedigreeFunction: parseFloat(patientData.DiabetesPedigreeFunction) || 0,
      Age: parseInt(patientData.Age, 10) || 0
    };

    console.log("Sending to Python service:", formattedData);

    const response = await axios.post(
      'https://phyton-service-1.onrender.com/predict',
      formattedData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000 // 20 second timeout
      }
    );

    // Process response to match your existing structure
    const processedResponse = {};
    for (const [modelName, modelData] of Object.entries(response.data)) {
      processedResponse[modelName] = {
        prediction: modelData.prediction,
        precentage: modelData.precentage, // Maintaining your spelling
        riskLevel: modelData.riskLevel,
        recommendation: modelData.recommendation
      };
    }

    console.log("Received from Python service:", processedResponse);
    return processedResponse;

  } catch (error) {
    console.error("Python Service Error:", {
      message: error.message,
      response: error.response?.data,
      code: error.code
    });
    
    throw new Error(
      error.response?.data?.error || 
      'Prediction service unavailable. Please try again later.'
    );
  }
}

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
