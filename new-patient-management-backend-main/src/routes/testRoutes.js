import express from "express";
import { createTest, getTestsByPatient, assignTestToConsultation, getAllTests } from "../controllers/testController.js";

const router = express.Router();

router.post("/", createTest); // Add Test
router.post("/assign", assignTestToConsultation); 
router.get("/", getAllTests); // Get All Tests
router.get("/:patient_id", getTestsByPatient);

export default router;
