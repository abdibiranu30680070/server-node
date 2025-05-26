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
    // Check user authentication
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch user info from DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user || !user.name || !user.email) {
      return res.status(404).json({ error: 'User not found or incomplete data' });
    }

    // Parse patient data safely
    let patientData;
    try {
      patientData = parsePatientData(req.body);
      console.log('Parsed patient data:', patientData);
    } catch (parseError) {
      console.error('Parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid patient data format' });
    }

    // Add user info to patient data
    patientData.userId = userId;
    patientData.name = user.name;

    // Call Python prediction service
    let predictionResponse;
    try {
      predictionResponse = await appService.callPythonService(patientData);
      console.log('Python prediction response:', predictionResponse);
    } catch (pyError) {
      console.error('Python service error:', pyError);
      return res.status(502).json({ error: 'Prediction service failed' });
    }

    if (
      !predictionResponse ||
      typeof predictionResponse !== 'object' ||
      Object.keys(predictionResponse).length === 0
    ) {
      console.error('Invalid or empty prediction response:', predictionResponse);
      return res.status(500).json({ error: 'Invalid response from prediction service' });
    }

    // Find best model prediction
    let bestModel = Object.keys(predictionResponse)[0];
    let highestPercentage = predictionResponse[bestModel].precentage;
    let finalPrediction = predictionResponse[bestModel].prediction;

    for (const model of Object.keys(predictionResponse)) {
      if (predictionResponse[model].precentage > highestPercentage) {
        bestModel = model;
        highestPercentage = predictionResponse[model].precentage;
        finalPrediction = predictionResponse[model].prediction;
      }
    }

    // Get risk level info
    const { riskLevel, recommendation } = getRiskLevel(highestPercentage);

    // Add prediction results to patient data
    patientData.prediction = finalPrediction;
    patientData.precentage = highestPercentage;
    patientData.riskLevel = riskLevel;
    patientData.recommendation = recommendation;

    console.log('Patient data before saving:', patientData);

    // Save patient data to DB, catch DB errors
    let patient;
    try {
      patient = await appService.createPatient(patientData);
    } catch (dbError) {
      console.error('Database error creating patient:', dbError);
      return res.status(500).json({ error: 'Failed to save patient data' });
    }

    // Create notification
    const notificationMessage = `Patient ${patient.name} has a ${patient.riskLevel} risk level. Prediction: ${
      patient.prediction ? 'Diabetic' : 'Not Diabetic'
    }`;

    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          patientId: patient.Id,
          message: notificationMessage,
          isRead: false,
        },
      });
    } catch (notifError) {
      console.error('Notification creation error:', notifError);
      // Not critical enough to fail whole request
    }

    // Send email notification
    try {
      await sendEmailNotification(user.email, patient.name, patient.riskLevel, patient.prediction);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Not critical enough to fail whole request
    }

    // Return success response
    return res.status(200).json({
      prediction: patient.prediction,
      precentage: patient.precentage,
      riskLevel: patient.riskLevel,
      recommendation: patient.recommendation,
      notification,
    });
  } catch (error) {
    console.error('Unexpected error in predict:', error.stack || error);
    return res.status(500).json({ error: 'Internal server error' });
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
