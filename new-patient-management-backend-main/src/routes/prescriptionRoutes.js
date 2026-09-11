import express from 'express';
import {
  createPrescription,
  getPrescriptionsByConsultationId,
  getPrescriptionsByPatient,
  getPrintablePrescription
} from '../controllers/prescriptionController.js';
import { validate, createPrescriptionSchema } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireRole('doctor', 'platform_admin'), validate(createPrescriptionSchema), createPrescription);
router.get('/:id/print', getPrintablePrescription);
router.get("/patient/:patient_id", getPrescriptionsByPatient);
router.get('/consultation/:consultation_id', getPrescriptionsByConsultationId);

export default router;
