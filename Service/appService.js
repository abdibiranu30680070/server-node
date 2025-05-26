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
 * @returns {Promise<Object>} - The created patient record.
 */
async function createPatient(patientData) {
  if (!patientData || !patientData.userId) {
    console.error("❌ Missing patient data or user ID.");
    throw new Error("Patient data and userId are required.");
  }

  try {
    return await prisma.patient.create({
      data: {
        Pregnancies: Number(patientData.Pregnancies),
        Glucose: Number(patientData.Glucose),
        BloodPressure: Number(patientData.BloodPressure),
        SkinThickness: Number(patientData.SkinThickness),
        Insulin: Number(patientData.Insulin),
        BMI: Number(patientData.BMI),
        DiabetesPedigreeFunction: Number(patientData.DiabetesPedigreeFunction),
        Age: Number(patientData.Age),
        userId: patientData.userId,
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

  const formattedData = {
    Pregnancies: Number(patientData.Pregnancies),
    Glucose: Number(patientData.Glucose),
    BloodPressure: Number(patientData.BloodPressure),
    SkinThickness: Number(patientData.SkinThickness),
    Insulin: Number(patientData.Insulin),
    BMI: Number(patientData.BMI),
    DiabetesPedigreeFunction: Number(patientData.DiabetesPedigreeFunction),
    Age: Number(patientData.Age)
  };

  try {
    console.log("📤 Sending data to Python API:", formattedData);

    const response = await axios.post('https://python-service-1.onrender.com/predict', formattedData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    console.log("✅ Received response from Python API:", response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("❌ Python API responded with error:", error.response.status, error.response.data);
    } else if (error.request) {
      console.error("❌ No response received from Python API:", error.request);
    } else {
      console.error("❌ Error setting up request to Python API:", error.message);
    }
    throw new Error("Failed to get a response from Python service.");
  }
}

module.exports = {
  createUser,
  findUserByEmail,
  getAllPatients,
  createPatient,
  callPythonService,
};
