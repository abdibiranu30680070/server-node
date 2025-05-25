const express = require("express");
const appController = require("../Controller/appController");
const router = express.Router();
const { authenticate } = require("../middleware/auth");

// Routes with authentication and role-based access
router.post("/predict", authenticate, appController.predict);
router.get("/getAllPatients", authenticate, appController.getAllPatients);
router.get("/getPatientDetails/:id", authenticate, appController.getPatientDetails); // New route

module.exports = router;
