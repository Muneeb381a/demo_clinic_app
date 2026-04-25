import express from 'express';
import {
  createCondition,
  getPatientConditions,
  updateCondition,
  deleteCondition
} from '../controllers/conditionController.js';

const router = express.Router();

router.route('/')
  .post(createCondition)
  .get(getPatientConditions);

router.route('/:id')
  .put(updateCondition)
  .delete(deleteCondition);

export default router;