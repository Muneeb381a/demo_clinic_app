import express from 'express';
import { getVisits, getVisitById, addVisit, updateVisit, deleteVisit } from '../controllers/visitController.js';

const router = express.Router();

// Get all visits
router.get('/', getVisits);

// Get a single visit by ID
router.get('/:id', getVisitById);

// Add a new visit
router.post('/', addVisit);

// Update an existing visit
router.put('/:id', updateVisit);

// Delete a visit
router.delete('/:id', deleteVisit);

export default router;
