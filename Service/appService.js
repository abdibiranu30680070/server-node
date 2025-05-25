const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require('axios');
const axiosRetry = require('axios-retry');

// Configure axios retry globally
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkError(error) || 
           error.response?.status >= 500 ||
           error.code === 'ECONNABORTED';
  }
});

/**
 * Validates required fields in an object
 * @param {Object} data - The object to validate
 * @param {Array} requiredFields - Array of required field names
 * @throws {Error} If any required field is missing
 */
function validateRequiredFields(data, requiredFields) {
  const missingFields = requiredFields.filter(field => !data[field] && data[field] !== 0);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Creates a new user in the database
 * @param {string} email - User's email
 * @param {string} name - User's name
 * @param {string} password - Hashed password
 * @returns {Promise<Object>} The created user record
 * @throws {Error} If creation fails
 */
async function createUser(email, name, password) {
  try {
    validateRequiredFields({ email, name, password }, ['email', 'name', 'password']);

    return await prisma.user.create({
      data: { 
        email, 
        name, 
        password 
      },
    });
  } catch (error) {
    console.error("Error creating user:", {
      error: error.message,
      stack: error.stack,
      input: { email, name }
    });
    
    if (error.code === 'P2002') {
      throw new Error("Email already exists");
    }
    throw new Error("Failed to create user");
  }
}

/**
 * Finds a user by email
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} User record or null if not found
 * @throws {Error} If query fails
 */
async function findUserByEmail(email) {
  try {
    if (!email) throw new Error("Email is required");

    return await prisma.user.findUnique({
      where: { email },
    });
  } catch (error) {
    console.error("Error finding user by email:", {
      error: error.message,
      email
    });
    throw new Error("Failed to find user");
  }
}

/**
 * Retrieves all patients for a specific user
 * @param {string} userId - ID of the user
 * @returns {Promise<Array>} List of patients
 * @throws {Error} If query fails
 */
async function getAllPatients(userId) {
  try {
    if (!userId) throw new Error("User ID is required");

    return await prisma.patient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    console.error("Error retrieving patients:", {
      error: error.message,
      userId
    });
    throw new Error("Failed to fetch patients");
  }
}

/**
 * Creates a new patient record
 * @param {Object} patientData - Patient's data
 * @returns {Promise<Object>} The created patient record
 * @throws {Error} If creation fails
 */
async function createPatient(patientData) {
  try {
    validateRequiredFields(patientData, ['userId']);
    
    console.log("Creating patient with data:", patientData);
    
    return await prisma.patient.create({
      data: patientData
    });
  } catch (error) {
    console.error("Error creating patient:", {
      error: error.message,
      stack: error.stack,
      patientData
    });
    
    if (error.code === 'P2003') {
      throw new Error("Invalid user reference");
    }
    throw new Error("Failed to create patient");
  }
}

/**
 * Calls the Python Flask API to predict diabetes
 * @param {Object} patientData - The patient's health data
 * @returns {Promise<Object>} The prediction result
 * @throws {Error} If prediction fails
 */
async function callPythonService(patientData) {
  try {
    validateRequiredFields(patientData, [
      'Pregnancies', 'Glucose', 'BloodPressure', 
      'SkinThickness', 'Insulin', 'BMI', 
      'DiabetesPedigreeFunction', 'Age'
    ]);

    const payload = {
      Pregnancies: parseInt(patientData.Pregnancies, 10),
      Glucose: parseFloat(patientData.Glucose),
      BloodPressure: parseFloat(patientData.BloodPressure),
      SkinThickness: parseFloat(patientData.SkinThickness),
      Insulin: parseFloat(patientData.Insulin),
      BMI: parseFloat(patientData.BMI),
      DiabetesPedigreeFunction: parseFloat(patientData.DiabetesPedigreeFunction),
      Age: parseInt(patientData.Age, 10)
    };

    console.log("Calling Python service with:", payload);

    const response = await axios.post(
      'https://phyton-service-1.onrender.com/predict',
      payload,
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log("Python service responded with:", response.data);
    return response.data;

  } catch (error) {
    console.error("Python Service Error:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack
    });

    if (error.response) {
      if (error.response.status === 502) {
        throw new Error("Prediction service is currently unavailable");
      }
      throw new Error(error.response.data?.error || "Prediction failed");
    }
    throw new Error("Failed to connect to prediction service");
  }
}

module.exports = {
  createUser,
  findUserByEmail,
  getAllPatients,
  createPatient,
  callPythonService,
  validateRequiredFields // Export for testing
};
