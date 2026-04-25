import express from 'express';
import { getDoctors, getDoctorById, addDoctor, updateDoctor, deleteDoctor } from '../controllers/doctorController.js';

const router = express.Router();

// Get all doctors
router.get('/', getDoctors);

// Get a single doctor by ID
router.get('/:id', getDoctorById);

// Add a new doctor
router.post('/', addDoctor);

// Update an existing doctor
router.put('/:id', updateDoctor);

// Delete a doctor
router.delete('/:id', deleteDoctor);

export default router;
