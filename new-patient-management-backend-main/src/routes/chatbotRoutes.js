import { Router }                          from "express";
import { analyzeSymptoms, getCacheStats } from "../controllers/chatbotController.js";

const router = Router();

router.post("/analyze", analyzeSymptoms);     // POST /api/chatbot/analyze
router.get("/stats",    getCacheStats);        // GET  /api/chatbot/stats

export default router;
