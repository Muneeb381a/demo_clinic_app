import express from 'express';
import {
    createPatient,
    getPatients,
    getPatient,
    updatePatient,
    deletePatient,
    getPatientHistory,
    searchPatient,
    suggestPatient,
} from '../controllers/patientController.js';
import { validate, createPatientSchema, updatePatientSchema } from '../middleware/validate.js';

const router = express.Router();

// Add search route before parameterized routes
router.get('/search', searchPatient);
router.get('/suggest', suggestPatient);

// Existing routes
router.route('/')
    .post(validate(createPatientSchema), createPatient)
    .get(getPatients);

router.route('/:id')
    .get(getPatient)
    .put(validate(updatePatientSchema), updatePatient)
    .delete(deletePatient);

router.get("/:id/history", getPatientHistory);

export default router;
