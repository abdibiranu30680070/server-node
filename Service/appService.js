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
 */
async function createUser(userData) {
  const { email, name, password } = userData;
  const requestId = uuidv4();

  try {
    validateRequiredFields({ email, name, password }, ["email", "name", "password"]);

    const user = await prisma.user.create({
      data: { email, name, password },
    });

    return user;
  } catch (error) {
    console.error(`[${requestId}] User creation failed:`, error.message);
    if (error.code === "P2002") {
      throw new Error("Email already exists");
    }
    throw new Error("Failed to create user");
  }
}

/**
 * Finds a user by email
 */
async function findUserByEmail(email) {
  const requestId = uuidv4();

  try {
    if (!email) throw new Error("Email is required");

    const user = await prisma.user.findUnique({ where: { email } });
    return user;
  } catch (error) {
    console.error(`[${requestId}] User lookup failed:`, error.message);
    throw new Error("Failed to find user");
  }
}

/**
 * Retrieves all patients for a specific user
 */
async function getAllPatients(userId) {
  const requestId = uuidv4();

  try {
    if (!userId) throw new Error("User ID is required");

    return await prisma.patient.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error(`[${requestId}] Patient fetch failed:`, error.message);
    throw new Error("Failed to fetch patients");
  }
}

/**
 * Creates a new patient record
 */
async function createPatient(patientData) {
  const requestId = uuidv4();

  try {
    validateRequiredFields(patientData, ["userId"]);
    return await prisma.patient.create({ data: patientData });
  } catch (error) {
    console.error(`[${requestId}] Patient creation failed:`, error.message);
    if (error.code === "P2003") {
      throw new Error("Invalid user reference");
    }
    throw new Error("Failed to create patient");
  }
}

/**
 * Calls the Python prediction service
 */
async function callPythonService(patientData) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const requiredFields = [
      "Pregnancies", "Glucose", "BloodPressure",
      "SkinThickness", "Insulin", "BMI",
      "DiabetesPedigreeFunction", "Age"
    ];
    validateRequiredFields(patientData, requiredFields);

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

    const response = await axios.post(PYTHON_SERVICE_URL, payload, {
      timeout: REQUEST_TIMEOUT,
      headers: { "Content-Type": "application/json" },
    });

    return response.data;
  } catch (error) {
    console.error(`[${requestId}] Python service call failed:`, {
      status: error.response?.status,
      message: error.message
    });
    throw new Error("Prediction service unavailable. Please try again later.");
  }
}

module.exports = {
  createUser,
  findUserByEmail,
  getAllPatients,
  createPatient,
  callPythonService,
  prisma,
};
