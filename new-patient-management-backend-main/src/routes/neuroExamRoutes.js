import express from "express"
import {
    createExam,
    getExamById,
    updateExam,
    deleteExam,
    listExamsByConsultation
  } from '../controllers/neuroExamController.js';
import { requireRole } from '../middleware/auth.js';


const router = express.Router()
const requireDoctor = requireRole('doctor', 'platform_admin');


// Create a new neurological exam
router.post('/', requireDoctor, createExam);

// Get a specific exam by ID
router.get('/:id', getExamById);

// Update an existing exam
router.put('/:id', requireDoctor, updateExam);

// Delete an exam
router.delete('/:id', requireDoctor, deleteExam);

// List all exams for a consultation
router.get('/consultation/:consultationId', listExamsByConsultation);

export default router;