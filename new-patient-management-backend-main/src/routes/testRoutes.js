import express from "express";
import { createTest, getTestsByPatient, assignTestToConsultation, getAllTests } from "../controllers/testController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createTest); // Add Test to the shared catalogue
router.post("/assign", requireRole('doctor', 'platform_admin'), assignTestToConsultation); // ordering tests is clinical
router.get("/", getAllTests); // Get All Tests
router.get("/:patient_id", getTestsByPatient);

export default router;
