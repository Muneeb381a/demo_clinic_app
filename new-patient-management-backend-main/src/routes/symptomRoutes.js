import express from 'express';
import {
    addSymptomToConsultation,
    createSymptom,
    getSymptoms,
    removeSymptomFromConsultation,
    updateConsultationSymptom,
    updateSymptom
} from '../controllers/symptomController.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const requireDoctor = requireRole('doctor', 'platform_admin');

// createSymptom / getSymptoms / updateSymptom manage the shared catalogue —
// not patient data — so they stay open to any authenticated clinic staff.
router.route('/')
    .post(createSymptom)
    .get(getSymptoms);

// These attach symptoms to a specific consultation — clinical documentation.
router.route('/:consultation_id/:symptom_id')
    .delete(requireDoctor, removeSymptomFromConsultation);

router.post('/consultations/:consultation_id', requireDoctor, addSymptomToConsultation);

router.put('/symptom/:id', updateSymptom);
router.put('/consultation-symptom', requireDoctor, updateConsultationSymptom);



export default router;