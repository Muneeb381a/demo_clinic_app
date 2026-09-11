import { Router }                          from "express";
import { analyzeSymptoms, getCacheStats } from "../controllers/chatbotController.js";
import { requireFeature }                 from "../middleware/clinicStatus.js";

const router = Router();

router.use(requireFeature("chatbot")); // gated behind the clinic's plan — see src/config/plans.js

router.post("/analyze", analyzeSymptoms);     // POST /api/chatbot/analyze
router.get("/stats",    getCacheStats);        // GET  /api/chatbot/stats

export default router;
