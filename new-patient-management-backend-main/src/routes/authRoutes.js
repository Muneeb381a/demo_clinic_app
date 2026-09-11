import express from "express";
import rateLimit from "express-rate-limit";
import { register, login, refresh, logout, me } from "../controllers/authController.js";
import { getInvite, acceptInvite } from "../controllers/inviteController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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

// Platform-admin only — creates a staff account in an existing clinic. Normal
// onboarding is POST /api/platform/clinics (new clinic + owner) or
// POST /api/clinic/invites (existing clinic invites its own staff).
router.post("/register", requireAuth, requireRole("platform_admin"), loginLimiter, register);
router.post("/login",    loginLimiter, login);
router.post("/refresh",  refresh);
router.post("/logout",   logout);
router.get("/me",        requireAuth, me);

// Invite-acceptance flow — public, the token itself is the credential.
router.get("/invite/:token", getInvite);
router.post("/accept-invite", loginLimiter, acceptInvite);

export default router;
