import express from 'express';
import {
  recordVitals,
  getVitalHistory
} from '../controllers/vitalController.js';
import { validate, recordVitalsSchema } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireRole('doctor', 'platform_admin'), validate(recordVitalsSchema), recordVitals);
router.get('/history/:patient_id', getVitalHistory);

export default router;
