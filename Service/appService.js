const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const axiosRetry = require("axios-retry");
const { v4: uuidv4 } = require("uuid");

// Initialize Prisma Client
const prisma = new PrismaClient();

// Configure Axios with retry logic
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkError(error) ||
      error.code === "ECONNABORTED" ||
      error.response?.status >= 500
    );
  },
});

// Constants
const PYTHON_SERVICE_URL = "https://phyton-service-1.onrender.com/predict";
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Validates required fields in an object
 * @param {Object} data - Data object to validate
 * @param {Array} requiredFields - Required field names
 * @throws {Error} If any required field is missing
 */
function validateRequiredFields(data, requiredFields) {
  const missingFields = requiredFields.filter(
    (field) => data[field] === undefined || data[field] === null
  );
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }
}

/**
 * Creates a new user in the database
 * @param {Object} userData - User data {email, name, password}
 * @returns {Promise<Object>} Created user record
 * @throws {Error} If creation fails
 */
async function createUser(userData) {
  const { email, name, password } = userData;
  const requestId = uuidv4();

  try {
    console.log(`[${requestId}] Validating user data`);
    validateRequiredFields({ email, name, password }, ["email", "name", "password"]);

    console.log(`[${requestId}] Creating user`);
    const user = await prisma.user.create({
      data: { email, name, password },
    });

    console.log(`[${requestId}] User created successfully`);
    return user;
  } catch (error) {
    console.error(`[${requestId}] Error creating user:`, {
      error: error.message,
      stack: error.stack,
      input: { email, name },
    });

    if (error.code === "P2002") {
      throw new Error("Email already exists");
    }
    throw new Error("Failed to create user");
  }
}

/**
 * Finds a user by email
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} User record or null
 * @throws {Error} If query fails
 */
async function findUserByEmail(email) {
  const requestId = uuidv4();

  try {
    if (!email) {
      throw new Error("Email is required");
    }

    console.log(`[${requestId}] Searching for user by email`);
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`[${requestId}] User not found`);
    } else {
      console.log(`[${requestId}] User found`);
    }

    return user;
  } catch (error) {
    console.error(`[${requestId}] Error finding user by email:`, {
      error: error.message,
      email,
    });
    throw new Error("Failed to find user");
  }
}

/**
 * Retrieves all patients for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of patients
 * @throws {Error} If query fails
 */
async function getAllPatients(userId) {
  const requestId = uuidv4();

  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    console.log(`[${requestId}] Fetching patients for user`);
    const patients = await prisma.patient.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    console.log(`[${requestId}] Found ${patients.length} patients`);
    return patients;
  } catch (error) {
    console.error(`[${requestId}] Error retrieving patients:`, {
      error: error.message,
      userId,
    });
    throw new Error("Failed to fetch patients");
  }
}

/**
 * Creates a new patient record
 * @param {Object} patientData - Patient data
 * @returns {Promise<Object>} Created patient record
 * @throws {Error} If creation fails
 */
async function createPatient(patientData) {
  const requestId = uuidv4();

  try {
    console.log(`[${requestId}] Validating patient data`);
    validateRequiredFields(patientData, ["userId"]);

    console.log(`[${requestId}] Creating patient record`);
    const patient = await prisma.patient.create({
      data: patientData,
    });

    console.log(`[${requestId}] Patient created successfully`);
    return patient;
  } catch (error) {
    console.error(`[${requestId}] Error creating patient:`, {
      error: error.message,
      stack: error.stack,
      patientData,
    });

    if (error.code === "P2003") {
      throw new Error("Invalid user reference");
    }
    throw new Error("Failed to create patient");
  }
}

/**
 * Calls the Python prediction service with circuit breaker pattern
 * @param {Object} patientData - Patient health data
 * @returns {Promise<Object>} Prediction results
 * @throws {Error} If prediction fails
 */
async function callPythonService(patientData) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    console.log(`[${requestId}] Validating patient data for prediction`);
    const requiredFields = [
      "Pregnancies",
      "Glucose",
      "BloodPressure",
      "SkinThickness",
      "Insulin",
      "BMI",
      "DiabetesPedigreeFunction",
      "Age",
    ];
    validateRequiredFields(patientData, requiredFields);

    // Prepare payload with type conversion
    const payload = {
      Pregnancies: parseInt(patientData.Pregnancies, 10),
      Glucose: parseFloat(patientData.Glucose),
      BloodPressure: parseFloat(patientData.BloodPressure),
      SkinThickness: parseFloat(patientData.SkinThickness),
      Insulin: parseFloat(patientData.Insulin),
      BMI: parseFloat(patientData.BMI),
      DiabetesPedigreeFunction: parseFloat(patientData.DiabetesPedigreeFunction),
      Age: parseInt(patientData.Age, 10),
    };

    console.log(`[${requestId}] Calling Python service with:`, payload);
    const response = await axios.post(PYTHON_SERVICE_URL, payload, {
      timeout: REQUEST_TIMEOUT,
      headers: { "Content-Type": "application/json" },
    });

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Python service responded in ${duration}ms`);

    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Python service failed after ${duration}ms:`, {
      error: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
      stack: error.stack,
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
  prisma, // Export for graceful shutdown
};
