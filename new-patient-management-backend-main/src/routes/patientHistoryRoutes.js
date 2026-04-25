import express from "express";
import { generatePrescriptionPDF, getPatientHistory, getSpecificConsultationForPatient, printConsultationForPatient, updateConsultationForPatient } from "../controllers/getPatientHistory.js";


const router = express.Router();

router.get("/patient-history/:patientId", getPatientHistory);
router.get("/patients/:patientId/consultations/:consultationId", getSpecificConsultationForPatient);
router.put('/patients/consultations/:consultationId', updateConsultationForPatient);
router.get("/patients/:patientId/consultations/:consultationId/print", printConsultationForPatient);
router.get("/patients/:patientId/consultations/:consultationId/pdf", generatePrescriptionPDF)


export default router;
