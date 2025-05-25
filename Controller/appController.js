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
  console.log('[1] Starting prediction process...');
  
  try {
    // 1. Authentication Check
    const userId = req.user?.userId;
    console.log('[2] Authenticated userId:', userId);
    if (!userId) {
      console.error('[2A] Authentication failed - no userId');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // 2. User Lookup
    console.log('[3] Fetching user from database...');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    console.log('[4] User lookup result:', JSON.stringify(user, null, 2));

    if (!user || !user.name || !user.email) {
      console.error('[4A] User data incomplete:', { hasName: !!user?.name, hasEmail: !!user?.email });
      return res.status(404).json({ error: 'User not found' });
    }

    // 3. Patient Data Processing
    console.log('[5] Parsing patient data...');
    let patientData = parsePatientData(req.body);
    console.log('[6] Parsed patient data:', JSON.stringify(patientData, null, 2));
    
    patientData.userId = userId;
    patientData.name = user.name;

    // 4. Python Service Call
    console.log('[7] Calling Python prediction service...');
    const predictionResponse = await appService.callPythonService(patientData);
    console.log('[8] Python service response:', JSON.stringify(predictionResponse, null, 2));

    if (!predictionResponse || typeof predictionResponse !== 'object') {
      console.error('[8A] Invalid prediction response:', typeof predictionResponse);
      throw new Error('Invalid response from prediction service');
    }

    // 5. Model Evaluation
    console.log('[9] Evaluating models...');
    let bestModel = Object.keys(predictionResponse)[0];
    let highestPrecentage = predictionResponse[bestModel].precentage;
    let finalPrediction = predictionResponse[bestModel].prediction;

    Object.keys(predictionResponse).forEach(model => {
      if (predictionResponse[model].precentage > highestPrecentage) {
        bestModel = model;
        highestPrecentage = predictionResponse[model].precentage;
        finalPrediction = predictionResponse[model].prediction;
      }
    });
    console.log('[10] Selected model:', bestModel, 'Percentage:', highestPrecentage);

    // 6. Risk Assessment
    console.log('[11] Calculating risk level...');
    const { riskLevel, recommendation } = getRiskLevel(highestPrecentage);
    patientData.prediction = finalPrediction;
    patientData.precentage = highestPrecentage;
    patientData.riskLevel = riskLevel;
    patientData.recommendation = recommendation;

    // 7. Database Operations
    console.log('[12] Saving patient to database...');
    const patient = await appService.createPatient(patientData);
    console.log('[13] Patient created:', JSON.stringify(patient, null, 2));

    console.log('[14] Creating notification...');
    const notificationMessage = `Patient ${patient.name} has a ${patient.riskLevel} risk level. Prediction: ${patient.prediction ? 'Diabetic' : 'Not Diabetic'}`;
    const notification = await prisma.notification.create({
      data: {
        patientId: patient.Id,
        message: notificationMessage,
        isRead: false,
      },
    });
    console.log('[15] Notification created:', JSON.stringify(notification, null, 2));

    // 8. Email Notification
    console.log('[16] Sending email notification...');
    await sendEmailNotification(user.email, patient.name, patient.riskLevel, patient.prediction);
    console.log('[17] Email sent successfully');

    // Final Response
    console.log('[18] Sending successful response');
    return res.status(200).json({
      prediction: patient.prediction,
      precentage: patient.precentage,
      riskLevel: patient.riskLevel,
      recommendation: patient.recommendation,
      notification,
    });

  } catch (error) {
    console.error('[ERROR] Full error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      requestBody: req.body,
    });
    
    return res.status(500).json({ 
      error: 'Prediction process failed',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
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
