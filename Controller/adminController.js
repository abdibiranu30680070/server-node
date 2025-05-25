const { PrismaClient } = require('@prisma/client');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 🟢 Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }, // Exclude password
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

// 🟢 Get all patients (Admin only)
const getAllPatients = async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      select: {
        Id: true,
        name: true,
        Age: true,
        BMI: true,
        Insulin: true,
        Glucose: true,
        BloodPressure: true,
        SkinThickness: true,
        DiabetesPedigreeFunction: true,
        prediction: true,
        precentage: true,
        CreatedAt: true,
        UpdatedAt: true,
        userId: true, // Make sure this matches the field in the Patient model
      },
    });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

const deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1️⃣ Get the patient's ID related to this user using findFirst
    const patient = await prisma.patient.findFirst({ where: { userId } });

    // 2️⃣ If the patient exists, delete related notifications first
    if (patient) {
      await prisma.notification.deleteMany({ where: { patientId: patient.Id } });

      // 3️⃣ Delete the patient
      await prisma.patient.delete({ where: { Id: patient.Id } });
    }

    // 4️⃣ Delete the user
    await prisma.user.delete({ where: { id: userId } });

    res.status(204).send(); // No content
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user", details: error.message });
  }
};



// 🟢 Update user role
const updateUserRole = async (req, res) => {
  const userId = req.params.id; // Keep it as a string
  const { newRole } = req.body;

  const validRoles = ['user', 'admin'];
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
};

// 🟢 Fetch system stats
const fetchSystemStats = async (req, res) => {
  console.log("Fetching system stats...");
  try {
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));

    // Run all queries in parallel
    const [totalUsers, activeUsers, activePatients, roleDistribution] = await Promise.all([
      prisma.user.count(), // Total users
      prisma.user.findMany({
        where: { patients: { some: {} } }, // Users with at least one patient
        select: { id: true },
      }),
      prisma.patient.count({ where: { CreatedAt: { gte: thirtyDaysAgo } } }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
    ]);

    // Get distinct user IDs manually
    const distinctUserIds = [...new Set(activeUsers.map(user => user.id))];
    const activeUsersCount = distinctUserIds.length; // Count distinct user IDs

    res.json({
      totalUsers,
      activeUsers: activeUsersCount,
      activePatients,
      roleDistribution: roleDistribution.map(entry => ({ role: entry.role, count: entry._count.id })),
    });

  } catch (error) {
    console.error("Error fetching system stats:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// 🟢 Fetch audit logs
const fetchAuditLogs = async (req, res) => {
  console.log("Received request for audit logs...");
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

// 🟢 Delete a patient by ID (Admin only)
const deletePatient = async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  console.log("Attempting to delete patient with Id:", patientId);

  if (isNaN(patientId)) {
    return res.status(400).json({ error: "Invalid patient ID" });
  }

  try {
    const patient = await prisma.patient.findUnique({ where: { Id: patientId } });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // 🔥 First delete related notifications
    await prisma.notification.deleteMany({
      where: { patientId: patientId },
    });

    // 🗑 Now delete the patient
    await prisma.patient.delete({ where: { Id: patientId } });

    res.status(204).send(); // No Content
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({ error: "Failed to delete patient", details: error.message });
  }
};


// 🟢 Shared filter builder and data fetcher
const buildExportFilters = async (req) => {
  const { dateFrom, dateTo, prediction } = req.query;
  const filters = {};

  // Date filtering
  if (dateFrom || dateTo) {
    filters.CreatedAt = {};
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (isNaN(fromDate)) throw new Error('Invalid start date format');
      filters.CreatedAt.gte = fromDate;
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (isNaN(toDate)) throw new Error('Invalid end date format');
      filters.CreatedAt.lte = toDate;
    }
  }

  // Prediction filtering
  if (prediction) {
    if (!['diabetic', 'non-diabetic'].includes(prediction)) {
      throw new Error('Invalid prediction filter value');
    }
    filters.prediction = prediction === 'diabetic';
  }

  const patients = await prisma.patient.findMany({ where: filters });
  if (patients.length === 0) throw new Error('No records found');
  
  return patients;
};

// 🟢 CSV Export
const exportCSV = async (req, res) => {
  try {
    const patients = await buildExportFilters(req);
    
    const fields = [
      'Id', 'name', 'Age', 'BMI', 'Insulin',
      'Glucose', 'BloodPressure', 'SkinThickness',
      'DiabetesPedigreeFunction', 'prediction',
      'precentage', 'CreatedAt' // Keep original spelling
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(patients);

    res
      .setHeader('Content-Type', 'text/csv')
      .setHeader('Content-Disposition', 'attachment; filename="patients_data.csv"')
      .send(csv);

  } catch (error) {
    console.error(`CSV Export Failed: ${error.message}`);
    const status = error.message.includes('No records') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

// 🟢 Excel Export
const exportExcel = async (req, res) => {
  try {
    const patients = await buildExportFilters(req);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Patients');

    worksheet.columns = [
      { header: 'ID', key: 'Id', width: 10 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Age', key: 'Age', width: 10 },
      { header: 'BMI', key: 'BMI', width: 10 },
      { header: 'Insulin', key: 'Insulin', width: 10 },
      { header: 'Glucose', key: 'Glucose', width: 10 },
      { header: 'Blood Pressure', key: 'BloodPressure', width: 15 },
      { header: 'Skin Thickness', key: 'SkinThickness', width: 15 },
      { header: 'Diabetes Pedigree', key: 'DiabetesPedigreeFunction', width: 15 },
      { header: 'Prediction', key: 'prediction', width: 20 },
      { header: 'Precentage', key: 'precentage', width: 10 }, // Preserve spelling
      { header: 'Created At', key: 'CreatedAt', width: 20 },
    ];

    patients.forEach(patient => {
      worksheet.addRow({
        ...patient,
        CreatedAt: new Date(patient.CreatedAt)
      });
    });

    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', 'attachment; filename="patients_data.xlsx"');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(`Excel Export Failed: ${error.message}`);
    const status = error.message.includes('No records') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};
// 🟢 Fetch Prediction Statistics for Charts
const fetchPredictionStats = async (req, res) => {
  try {
      // Count predictions by type
      const diabeticCount = await prisma.patient.count({
        where: { prediction: true }, // Assuming true means diabetic
      });
      const nonDiabeticCount = await prisma.patient.count({
        where: { prediction: false }, // Assuming false means non-diabetic
      });
      
      // Count predictions over time (last 7 days)
      const pastWeek = new Date();
      pastWeek.setDate(pastWeek.getDate() - 7);

      const weeklyPredictions = await prisma.patient.groupBy({
          by: ['CreatedAt'], // Ensure 'CreatedAt' is the correct field name
          where: { 
              CreatedAt: { 
                  gte: pastWeek // Filter by the past 7 days
              }
          },
          _count: { Id: true }, // Ensure 'Id' is the correct field to count
          orderBy: { CreatedAt: 'asc' } // Order by date ascending
      });

      // Format data for frontend
      const formattedWeeklyPredictions = weeklyPredictions.map(entry => ({
          date: entry.CreatedAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
          count: entry._count.Id
      }));

      // Return the stats
      res.json({
          totalPredictions: diabeticCount + nonDiabeticCount,
          diabetic: diabeticCount,
          nonDiabetic: nonDiabeticCount,
          weeklyPredictions: formattedWeeklyPredictions
      });

  } catch (error) {
      console.error('Error fetching prediction stats:', error);
      res.status(500).json({ error: 'Error fetching statistics' });
  }
};



// 🟢 Get all feedbacks
const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      select: {
        id: true,
        message: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true } // optional: include user info
        }
      },
      orderBy: { createdAt: 'desc' } // newest first
    });
    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

module.exports = { 
  getAllUsers, getAllPatients, deleteUser, updateUserRole, 
  fetchSystemStats, fetchAuditLogs, deletePatient, 
  exportCSV, exportExcel, fetchPredictionStats,
  getAllFeedback // ← add this
};
