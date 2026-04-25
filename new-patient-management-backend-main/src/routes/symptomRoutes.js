import express from 'express';
import {
    addSymptomToConsultation,
    createSymptom,
    getSymptoms,
    removeSymptomFromConsultation,
    updateConsultationSymptom,
    updateSymptom
} from '../controllers/symptomController.js';

const router = express.Router();

router.route('/')
    .post(createSymptom)
    .get(getSymptoms);

router.route('/:consultation_id/:symptom_id')
    .delete(removeSymptomFromConsultation);

router.post('/consultations/:consultation_id', addSymptomToConsultation);

router.put('/symptom/:id', updateSymptom);
router.put('/consultation-symptom', updateConsultationSymptom);



export default router;