import express from 'express';
import {
    getMedicineInstructions,
    getMedicineInstructionById,
    addMedicineInstruction,
    updateMedicineInstruction,
    deleteMedicineInstruction
} from '../controllers/medicineInstructionsController.js';

const router = express.Router();

router.get('/', getMedicineInstructions); // Get all instructions
router.get('/:id', getMedicineInstructionById); // Get a single instruction by ID
router.post('/', addMedicineInstruction); // Add new instruction
router.put('/:id', updateMedicineInstruction); // Update instruction by ID
router.delete('/:id', deleteMedicineInstruction); // Delete instruction by ID

export default router;
