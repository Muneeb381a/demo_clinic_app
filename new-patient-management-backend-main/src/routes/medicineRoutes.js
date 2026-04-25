import express from 'express';
import {
    createMedicine,
    searchMedicines,
    getAllMedicines
} from '../controllers/medicineController.js'

const router = express.Router();

router.get("/", getAllMedicines)
router.post("/", createMedicine)
router.get("/search", searchMedicines)




export default router;
