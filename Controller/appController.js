const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');  // Import dotenv
const appService = require('../Service/appService');

// Load environment variables from the .env file
dotenv.config();

const prisma = new PrismaClient();

// Function to validate and parse patient data
const parsePatientData = (patientData) => {
  const fieldsToValidate = [
    'age', 'bmi', 'insulin', 'Pregnancies', 'Glucose',
    'BloodPressure', 'SkinThickness', 'DiabetesPedigreeFunction', 'name'
  ];

  for (let field of fieldsToValidate) {
    if ((patientData[field] === undefined || isNaN(patientData[field])) && field !== 'name') {
      throw new Error(`Invalid or missing value for field: ${field}`);
    }
  }

  return {
    name: patientData.name || 'Unknown',
    Age: parseInt(patientData.age, 10) || 0,
    BMI: parseFloat(patientData.bmi) || 0.0,
    Insulin: parseFloat(patientData.insulin) || 0.0,
    Pregnancies: parseInt(patientData.Pregnancies, 10) || 0,
    Glucose: parseFloat(patientData.Glucose) || 0.0,
    BloodPressure: parseFloat(patientData.BloodPressure) || 0.0,
    SkinThickness: parseFloat(patientData.SkinThickness) || 0.0,
    DiabetesPedigreeFunction: parseFloat(patientData.DiabetesPedigreeFunction) || 0.0,
    prediction: false,
    precentage: 0.0, // Fixed field name
    userId: patientData.userId,
  };
};

// Function to determine risk level and recommendation
const getRiskLevel = (precentage) => {
  if (precentage < 40) {
    return { riskLevel: 'Low', recommendation: 'Maintain a healthy lifestyle and regular checkups.' };
  } else if (precentage < 70) {
    return { riskLevel: 'Moderate', recommendation: 'Monitor health regularly and consider lifestyle improvements like diet and exercise.' };
  } else if (precentage < 90) {
    return { riskLevel: 'High', recommendation: 'Consult a doctor and undergo further medical checkups.' };
  } else {
    return { riskLevel: 'Critical', recommendation: 'Immediate medical consultation is required.' };
  }
};

// Create a Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Fetch email from .env
    pass: process.env.EMAIL_PASS, // Fetch password from .env
  },
});

// Function to send email
const sendEmailNotification = async (userEmail, patientName, riskLevel, prediction) => {
  const mailOptions = {
    from: process.env.EMAIL_USER, // Use the email from the .env file
    to: userEmail,
    subject: `Patient Prediction and Risk Level: ${patientName}`,
    text: `Hello,\n\nThis is an update for your patient ${patientName}.\n\nRisk Level: ${riskLevel}\nPrediction: ${prediction ? 'Diabetic' : 'Not Diabetic'}\n\nBest regards,\nYour Health Platform`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// 🟢 Updated Predict Function with Email Notification Logic
const predict = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user || !user.name || !user.email) {
      return res.status(404).json({ error: 'User not found or incomplete data' });
    }

    // Parse and validate patient data
    let patientData;
    try {
      patientData = parsePatientData(req.body);
    } catch (parseError) {
      console.error("Failed to parse patient data:", parseError);
      return res.status(400).json({ error: 'Invalid patient data format' });
    }

    patientData.userId = userId;
    patientData.name = user.name;

    console.log("🔎 Patient data before prediction call:", patientData);

    // Call Python prediction service
    const predictionResponse = await appService.callPythonService(patientData);
    console.log("🛠️ Raw prediction response:", predictionResponse);

    if (!predictionResponse || typeof predictionResponse !== 'object') {
      throw new Error('Invalid response from prediction service');
    }

    // Validate prediction response structure
    let bestModel = null;
    let highestPercentage = -Infinity;
    let finalPrediction = null;

    for (const model of Object.keys(predictionResponse)) {
      const modelData = predictionResponse[model];
      if (
        !modelData ||
        typeof modelData.precentage !== 'number' ||
        modelData.prediction === undefined
      ) {
        throw new Error(`Malformed prediction data from model: ${model}`);
      }

      if (modelData.precentage > highestPercentage) {
        bestModel = model;
        highestPercentage = modelData.precentage;
        finalPrediction = modelData.prediction;
      }
    }

    if (bestModel === null) {
      throw new Error('No valid prediction models found');
    }

    // Get risk level and recommendation
    const { riskLevel, recommendation } = getRiskLevel(highestPercentage);

    // Update patientData with prediction results
    patientData.prediction = finalPrediction;
    patientData.precentage = highestPercentage;
    patientData.riskLevel = riskLevel;
    patientData.recommendation = recommendation;

    console.log("📦 Patient data before saving:", patientData);

    // Save patient data
    const patient = await appService.createPatient(patientData);

    // Create notification
    const notificationMessage = `Patient ${patient.name} has a ${patient.riskLevel} risk level. Prediction: ${patient.prediction ? 'Diabetic' : 'Not Diabetic'}`;
    const notification = await prisma.notification.create({
      data: {
        patientId: patient.id,  // Make sure this matches your schema (lowercase 'id')
        message: notificationMessage,
        isRead: false,
      },
    });

    // Send email notification (non-blocking)
    try {
      await sendEmailNotification(user.email, patient.name, patient.riskLevel, patient.prediction);
    } catch (emailError) {
      console.error("⚠️ Failed to send email notification:", emailError);
      // We continue without failing the request
    }

    // Send back response
    return res.status(200).json({
      prediction: patient.prediction,
      precentage: patient.precentage,
      riskLevel: patient.riskLevel,
      recommendation: patient.recommendation,
      notification,
    });
  } catch (error) {
    console.error('Error in prediction:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// 🟢 Fetch all patients for the authenticated user

const getAllPatients = async (req, res) => {

  try {

    const userId = req.user?.userId;

    if (!userId) {

      return res.status(401).json({ error: 'User not authenticated' });

    }


    const patients = await prisma.patient.findMany({

      where: { userId: userId },

    });


    if (!patients || patients.length === 0) {

      return res.status(404).json({ message: 'No patients found for this user.' });

    }


    return res.status(200).json(patients);

  } catch (error) {

    console.error('Error fetching patients:', error.message);

    return res.status(500).json({ error: error.message });

  }

};


// 🟢 Fetch details of a specific patient

const getPatientDetails = async (req, res) => {

  try {

    // const userId = req.user?.userId;

    // if (!userId) {

    //   return res.status(401).json({ error: 'User not authenticated' });

    // }


    const patientId = parseInt(req.params.id, 10);

    if (isNaN(patientId)) {

      return res.status(400).json({ error: 'Invalid patient ID' });

    }


    // Fetch the specific patient's details (only if the patient belongs to the authenticated user)

    const patient = await prisma.patient.findUnique({

      where: {

        Id: patientId,

       // userId: userId, // Ensures the user only sees their own patients

      },

    });


    if (!patient) {

      return res.status(404).json({ error: 'Patient not found or does not belong to the user.' });

    }


    return res.status(200).json(patient);

  } catch (error) {

    console.error('Error fetching patient details:', error);

    return res.status(500).json({ error: 'Internal server error' });

  }

};


module.exports = { predict, getAllPatients, getPatientDetails };
