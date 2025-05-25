const express = require('express');
const router = express.Router();
const { 
    getAllUsers, deleteUser, updateUserRole, fetchSystemStats, fetchAuditLogs, 
    getAllPatients, deletePatient, exportCSV, exportExcel , fetchPredictionStats , getAllFeedback
} = require('../Controller/adminController');
const { authenticate, isAdmin } = require('../middleware/auth');

// 🟢 Admin User Management Routes
router.get('/users', authenticate, isAdmin, getAllUsers);
router.delete('/users/:id', authenticate, isAdmin, deleteUser);
router.patch('/users/:id/role', authenticate, isAdmin, updateUserRole);

// 🟢 System Stats & Audit Logs
router.get('/system-stats', authenticate, isAdmin, fetchSystemStats);
router.get('/audit-logs', authenticate, isAdmin, fetchAuditLogs);

// 🟢 Patient Management Routes
router.get('/getAllPatientsForAdmin', authenticate, isAdmin, getAllPatients);
router.delete("/deletePatient/:id", authenticate, isAdmin, deletePatient);

// 🟢 Export Reports (CSV & Excel)
router.get('/export/csv', authenticate, isAdmin, exportCSV);
router.get('/export/excel', authenticate, isAdmin, exportExcel);
// 🟢 Fetch chart data
router.get('/prediction-stats', authenticate, isAdmin, fetchPredictionStats);
router.get('/feedbacks',authenticate, isAdmin,getAllFeedback);

module.exports = router;
