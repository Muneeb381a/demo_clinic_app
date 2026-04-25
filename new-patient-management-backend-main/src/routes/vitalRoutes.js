import express from 'express';
import {
  recordVitals,
  getVitalHistory
} from '../controllers/vitalController.js';
import { validate, recordVitalsSchema } from '../middleware/validate.js';

const router = express.Router();

router.post('/', validate(recordVitalsSchema), recordVitals);
router.get('/history/:patient_id', getVitalHistory);

export default router;
