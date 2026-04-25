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

const router = express.Router();

// Batch endpoint — registered BEFORE /:id and /:consultationId to avoid route conflicts
router.post('/complete', saveCompleteConsultation);

router.post('/', validate(createConsultationSchema), createConsultation);
router.get('/', getAllConsultations);
router.post('/:consultationId/symptoms', addSymptomsToConsultation);
router.post('/full', createFullConsultation);
router.post('/tests/assign', assignTestToConsultation);
router.get('/:id', getConsultationDetails);
router.get('/patient/:patientId', getConsultationsByPatient);

export default router;
