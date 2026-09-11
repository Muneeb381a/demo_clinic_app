import express from "express";
import {
  symptomAutocomplete,
  getPrescriptionSuggestions,
  recordFeedback,
  processFeedback,
  getHistorySuggestions,
  getSimilarCases,
} from "../controllers/suggestionController.js";
import { requireFeature } from "../middleware/clinicStatus.js";

const router = express.Router();

// The whole AI suggestion engine is gated behind the clinic's plan — see
// src/config/plans.js. process-feedback (below) is a global cron job, not a
// per-clinic action, so it's deliberately registered before this gate.

// Cron / admin: process pending feedback to update frequency counters
// POST /api/suggest/process-feedback  (requires x-cron-secret header)
router.post("/process-feedback", processFeedback);

router.use(requireFeature("ai_suggestions"));

// Symptom autocomplete — used by the frontend search input
// GET /api/suggest/symptoms?q=fever&lang=en
router.get("/symptoms", symptomAutocomplete);

// Main suggestion engine — symptom IDs → ranked diseases + medicines + tests
// POST /api/suggest/prescription  { symptom_ids: [1, 5, 12] }
router.post("/prescription", getPrescriptionSuggestions);

// Fallback: history-based suggestions from past prescriptions
// GET /api/suggest/history?symptom_ids=1,5,12
router.get("/history", getHistorySuggestions);

// Record doctor's accepted/dismissed choices (fires-and-forgets asynchronously)
// POST /api/suggest/feedback
router.post("/feedback", recordFeedback);

// Similar past cases — Jaccard similarity on consultation_symptoms
// GET /api/suggest/similar-cases?symptom_ids=1,5,12&limit=5
router.get("/similar-cases", getSimilarCases);

export default router;
