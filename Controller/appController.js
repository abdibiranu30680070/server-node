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
    // Validate authentication
    if (!req.user?.userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userId = req.user.userId;

    // Get only the needed user data - fixed query
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        name: true,
        email: true
        // Removed isActive since it's not in your model
      }
    });

    if (!user) {
      return res.status(403).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Validate and parse patient data
    let patientData;
    try {
      patientData = parsePatientData(req.body);
      if (!patientData || typeof patientData !== 'object') {
        throw new Error('Invalid patient data structure');
      }
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid patient data format',
        details: parseError.message,
        code: 'INVALID_DATA'
      });
    }

    // Add metadata to patient data
    const enrichedData = {
      ...patientData,
      userId,
      name: user.name,
      timestamp: new Date().toISOString()
    };

    // Call prediction service with retry logic
    let predictionResponse;
    try {
      predictionResponse = await retry(
        () => appService.callPythonService(enrichedData),
        {
          retries: 2,
          minTimeout: 1000,
          factor: 2
        }
      );
      
      if (!predictionResponse || Object.keys(predictionResponse).length === 0) {
        throw new Error('Empty prediction response');
      }
    } catch (pyError) {
      console.error('Prediction service failed after retries:', pyError);
      return res.status(503).json({
        error: 'Prediction service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        retryAfter: 60 // seconds
      });
    }

    // Process prediction results
    const { bestModel, highestPercentage, finalPrediction } = processPredictionResults(predictionResponse);
    const { riskLevel, recommendation } = getRiskLevel(highestPercentage);

    // Create database transaction for atomic operations
    const [patient, notification] = await prisma.$transaction([
      prisma.patient.create({
        data: {
          ...enrichedData,
          prediction: finalPrediction,
          confidence: highestPercentage,
          riskLevel,
          recommendation,
          modelUsed: bestModel
        }
      }),
      prisma.notification.create({
        data: {
          userId,
          message: `New prediction for ${user.name}: ${riskLevel} risk`,
          type: 'PREDICTION_RESULT'
        }
      })
    ]).catch(async (txError) => {
      console.error('Transaction failed:', txError);
      throw new Error('Failed to save prediction results');
    });

    // Async email notification (fire-and-forget)
    sendEmailNotification({
      to: user.email,
      subject: `Prediction Results for ${patient.name}`,
      template: 'prediction-result',
      data: {
        name: patient.name,
        prediction: finalPrediction,
        confidence: highestPercentage,
        riskLevel,
        recommendation
      }
    }).catch(emailError => {
      console.error('Email failed silently:', emailError);
    });

    // Calculate response time
    const elapsedTime = process.hrtime(startTime);
    const responseTimeMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;

    return res.status(200).json({
      success: true,
      prediction: finalPrediction,
      confidence: highestPercentage,
      riskLevel,
      recommendation,
      modelUsed: bestModel,
      responseTime: `${responseTimeMs.toFixed(2)}ms`
    });

  } catch (error) {
    console.error('Prediction pipeline failed:', {
      error: error.stack || error.message,
      userId: req.user?.userId,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      error: 'Internal prediction error',
      code: 'INTERNAL_ERROR',
      reference: `ERR-${Date.now()}`
    });
  }
};

// Helper function to process prediction results
function processPredictionResults(predictionResponse) {
  let bestModel = Object.keys(predictionResponse)[0];
  let highestPercentage = predictionResponse[bestModel].percentage;
  let finalPrediction = predictionResponse[bestModel].prediction;

  for (const [model, data] of Object.entries(predictionResponse)) {
    if (data.percentage > highestPercentage) {
      bestModel = model;
      highestPercentage = data.percentage;
      finalPrediction = data.prediction;
    }
  }

  return { bestModel, highestPercentage, finalPrediction };
}

// Retry utility function
function retry(fn, options = { retries: 3, minTimeout: 1000 }) {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount) => {
      fn()
        .then(resolve)
        .catch((err) => {
          if (retryCount >= options.retries) {
            return reject(err);
          }
          const timeout = options.minTimeout * Math.pow(options.factor || 2, retryCount);
          setTimeout(() => attempt(retryCount + 1), timeout);
        });
    };
    attempt(0);
  });
}

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
