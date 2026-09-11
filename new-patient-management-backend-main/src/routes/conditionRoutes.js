import express from 'express';
import {
  createCondition,
  getPatientConditions,
  updateCondition,
  deleteCondition
} from '../controllers/conditionController.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const requireDoctor = requireRole('doctor', 'platform_admin');

router.route('/')
  .post(requireDoctor, createCondition)
  .get(getPatientConditions);

router.route('/:id')
  .put(requireDoctor, updateCondition)
  .delete(requireDoctor, deleteCondition);

export default router;