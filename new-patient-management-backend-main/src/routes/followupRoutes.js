import express from "express";
import { getFollowUps, scheduleFollowUp, updateFollowUp } from "../controllers/followupController.js";
import { validate, scheduleFollowUpSchema } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

const followupRoutes = express.Router();
const requireDoctor = requireRole('doctor', 'platform_admin');

followupRoutes.route('/consultations/:consultation_id/followups')
  .get(getFollowUps)
  .post(requireDoctor, validate(scheduleFollowUpSchema), scheduleFollowUp);

followupRoutes.route('/consultations/:consultation_id/followups/:id')
  .put(requireDoctor, updateFollowUp);

export default followupRoutes;
