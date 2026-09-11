import express from 'express';
import {
  createConsultation,
  getConsultationDetails,
  getAllConsultations,
  addSymptomsToConsultation,
  getConsultationsByPatient,
  createFullConsultation,
  saveCompleteConsultation,
} from '../controllers/consultationController.js';
import { assignTestToConsultation } from '../controllers/testController.js';
import { validate, createConsultationSchema } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const requireDoctor = requireRole('doctor', 'platform_admin');

// Batch endpoint — registered BEFORE /:id and /:consultationId to avoid route conflicts
router.post('/complete', requireDoctor, saveCompleteConsultation);

router.post('/', requireDoctor, validate(createConsultationSchema), createConsultation);
router.get('/', getAllConsultations);
router.post('/:consultationId/symptoms', requireDoctor, addSymptomsToConsultation);
router.post('/full', requireDoctor, createFullConsultation);
router.post('/tests/assign', requireDoctor, assignTestToConsultation);
router.get('/:id', getConsultationDetails);
router.get('/patient/:patientId', getConsultationsByPatient);

export default router;
