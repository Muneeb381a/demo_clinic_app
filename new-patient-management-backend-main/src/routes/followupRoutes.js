import express from "express";
import { getFollowUps, scheduleFollowUp, updateFollowUp } from "../controllers/followupController.js";
import { validate, scheduleFollowUpSchema } from "../middleware/validate.js";

const followupRoutes = express.Router();

followupRoutes.route('/consultations/:consultation_id/followups')
  .get(getFollowUps)
  .post(validate(scheduleFollowUpSchema), scheduleFollowUp);

followupRoutes.route('/consultations/:consultation_id/followups/:id')
  .put(updateFollowUp);

export default followupRoutes;
