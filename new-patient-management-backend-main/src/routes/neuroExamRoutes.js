import express from "express"
import {
    createExam,
    getExamById,
    updateExam,
    deleteExam,
    listExamsByConsultation
  } from '../controllers/neuroExamController.js';


const router = express.Router()


// Create a new neurological exam
router.post('/', createExam);

// Get a specific exam by ID
router.get('/:id', getExamById);

// Update an existing exam
router.put('/:id', updateExam);

// Delete an exam
router.delete('/:id', deleteExam);

// List all exams for a consultation
router.get('/consultation/:consultationId', listExamsByConsultation);

export default router;