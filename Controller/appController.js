const { PrismaClient } = require("@prisma/client");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const appService = require("../services/appService");

// Initialize services
dotenv.config();
const prisma = new PrismaClient();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Parses and validates patient data
 */
function parsePatientData(patientData) {
  const fieldsToValidate = [
    "age", "bmi", "insulin", "Pregnancies", "Glucose",
    "BloodPressure", "SkinThickness", "DiabetesPedigreeFunction"
  ];

  for (let field of fieldsToValidate) {
    if ((patientData[field] === undefined || isNaN(patientData[field]))) {
      throw new Error(`Invalid or missing value for field: ${field}`);
    }
  }

  return {
    name: patientData.name || "Unknown",
    Age: parseInt(patientData.age, 10),
    BMI: parseFloat(patientData.bmi),
    Insulin: parseFloat(patientData.insulin),
    Pregnancies: parseInt(patientData.Pregnancies, 10),
    Glucose: parseFloat(patientData.Glucose),
    BloodPressure: parseFloat(patientData.BloodPressure),
    SkinThickness: parseFloat(patientData.SkinThickness),
    DiabetesPedigreeFunction: parseFloat(patientData.DiabetesPedigreeFunction),
    prediction: false,
    precentage: 0.0,
    userId: patientData.userId,
  };
}

/**
 * Determines risk level based on percentage
 */
function getRiskLevel(precentage) {
  if (precentage < 40) {
    return { 
      riskLevel: "Low", 
      recommendation: "Maintain a healthy lifestyle and regular checkups." 
    };
  } else if (precentage < 70) {
    return { 
      riskLevel: "Moderate", 
      recommendation: "Monitor health regularly and consider lifestyle improvements." 
    };
  } else if (precentage < 90) {
    return { 
      riskLevel: "High", 
      recommendation: "Consult a doctor and undergo further medical checkups." 
    };
  }
  return { 
    riskLevel: "Critical", 
    recommendation: "Immediate medical consultation is required." 
  };
}

/**
 * Sends email notification
 */
async function sendEmailNotification(userEmail, patientName, riskLevel, prediction) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `Patient Prediction: ${patientName}`,
      text: `Patient ${patientName}\nRisk Level: ${riskLevel}\nPrediction: ${prediction ? "Diabetic" : "Not Diabetic"}`,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
  }
}

/**
 * Main prediction controller
 */
async function predict(req, res) {
  try {
    // Authentication check
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user?.email) {
      return res.status(404).json({ error: "User not found" });
    }

    // Process and validate patient data
    let patientData = parsePatientData(req.body);
    patientData.userId = userId;
    patientData.name = user.name;

    // Get prediction from Python service
    const predictionResponse = await appService.callPythonService(patientData);
    if (!predictionResponse) {
      throw new Error("Invalid prediction response");
    }

    // Evaluate models
    let bestModel = Object.keys(predictionResponse)[0];
    let highestPrecentage = predictionResponse[bestModel].precentage ?? 
                          predictionResponse[bestModel].percentage ?? 0;
    let finalPrediction = predictionResponse[bestModel].prediction ?? 
                         predictionResponse[bestModel].Prediction ?? false;

    Object.keys(predictionResponse).forEach(model => {
      const current = predictionResponse[model].precentage ?? 
                     predictionResponse[model].percentage;
      if (current > highestPrecentage) {
        bestModel = model;
        highestPrecentage = current;
        finalPrediction = predictionResponse[model].prediction ?? 
                         predictionResponse[model].Prediction;
      }
    });

    // Prepare final data
    const { riskLevel, recommendation } = getRiskLevel(highestPrecentage);
    patientData.prediction = finalPrediction;
    patientData.precentage = highestPrecentage;
    patientData.riskLevel = riskLevel;
    patientData.recommendation = recommendation;

    // Save to database
    const patient = await appService.createPatient(patientData);

    // Create notification
    await prisma.notification.create({
      data: {
        patientId: patient.Id,
        message: `Patient ${patient.name} has ${riskLevel} risk`,
        isRead: false,
      },
    });

    // Send email
    await sendEmailNotification(user.email, patient.name, riskLevel, finalPrediction);

    return res.status(200).json({
      prediction: finalPrediction,
      precentage: highestPrecentage,
      riskLevel,
      recommendation,
    });

  } catch (error) {
    console.error("Prediction failed:", error.message);
    return res.status(500).json({ 
      error: "Prediction failed",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Get all patients for a user
 */
async function getAllPatients(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const patients = await appService.getAllPatients(userId);
    return res.status(200).json(patients);
  } catch (error) {
    console.error("Failed to fetch patients:", error.message);
    return res.status(500).json({ error: "Failed to fetch patients" });
  }
}

/**
 * Get details of a specific patient
 */
async function getPatientDetails(req, res) {
  try {
    const patientId = parseInt(req.params.id, 10);
    if (isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patient ID" });
    }

    const patient = await prisma.patient.findUnique({
      where: { Id: patientId },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    return res.status(200).json(patient);
  } catch (error) {
    console.error("Failed to fetch patient details:", error.message);
    return res.status(500).json({ error: "Failed to fetch patient details" });
  }
}

module.exports = {
  predict,
  getAllPatients,
  getPatientDetails,
};
