import express from 'express';
import { addOption, getOptions, getAllOptions } from '../controllers/neuroOptionsController.js';


const router = express.Router();

// Batch endpoint — must be registered BEFORE /:field so it isn't swallowed by the param route
router.get('/all', getAllOptions);

router.get('/:field', getOptions);
router.post('/:field', addOption);

export default router;
