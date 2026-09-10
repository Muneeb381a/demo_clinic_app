import express from "express";
import rateLimit from "express-rate-limit";
import { register, login, refresh, logout, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Stricter than the global limiter: throttle credential-guessing per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ success: false, message: "Too many attempts. Try again in 15 minutes." }),
});

router.post("/register", loginLimiter, register);
router.post("/login",    loginLimiter, login);
router.post("/refresh",  refresh);
router.post("/logout",   logout);
router.get("/me",        requireAuth, me);

export default router;
