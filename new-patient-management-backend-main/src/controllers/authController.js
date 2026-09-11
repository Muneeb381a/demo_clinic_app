// src/controllers/authController.js
import { pool } from "../models/db.js";
import { signAccessToken } from "../middleware/auth.js";
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/refreshTokens.js";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

// Only pass through something that will parse as INET; anything else -> null.
const asInet = (v) =>
  typeof v === "string" && /^[0-9a-fA-F:.]+$/.test(v) && v.length <= 45 ? v : null;

// login/refresh/me all return "who is this session" — each joins clinics so
// the frontend knows the clinic's plan/features without a separate request
// (see src/config/plans.js). Pulled into one helper so the shape stays
// identical across all three. `null` for a platform admin (no clinic_id).
export const withClinicPlan = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  clinic_id: row.clinic_id,
  is_owner: row.is_owner,
  ...(row.specialization !== undefined && { specialization: row.specialization }),
  clinic: row.clinic_id ? { plan: row.clinic_plan, features: row.clinic_features } : null,
});

// Exported so inviteController.js (accept-invite also starts a session) can
// reuse these instead of duplicating the refresh-cookie/JWT dance.
export const clientMeta = (req) => ({
  userAgent: req.headers["user-agent"],
  ip: asInet(req.ip),
});

// Sets the rotating refresh cookie and returns the short-lived access token.
export const startSession = async (req, res, user) => {
  const { raw } = await issueRefreshToken(user.id, clientMeta(req));
  res.cookie(REFRESH_COOKIE, raw, refreshCookieOptions(req));
  return signAccessToken(user);
};

/**
 * POST /api/auth/register
 * Platform-admin only (see routes/authRoutes.js) — creates a staff account
 * directly in an existing clinic. The normal way to onboard a clinic's first
 * user is POST /api/platform/clinics (creates the clinic + its owner in one
 * step); this endpoint is the lower-level primitive for adding someone to a
 * clinic that already exists. Everyday staff growth should go through
 * clinic-owner invites (POST /api/clinic/invites), not this endpoint.
 *
 * Body: { name, email, password, clinic_id, role?, is_owner?, specialization? }
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, clinic_id, role, is_owner, specialization } = req.body;

    if (!name || !email || !password || !clinic_id) {
      return res
        .status(400)
        .json({ success: false, message: "name, email, password and clinic_id are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }
    const resolvedRole = ["doctor", "receptionist"].includes(role) ? role : "doctor";

    const clinic = await pool.query("SELECT id FROM clinics WHERE id = $1 AND status = 'active'", [clinic_id]);
    if (clinic.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const existing = await pool.query("SELECT id FROM auth_users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO auth_users (name, email, password_hash, salt, role, specialization, clinic_id, is_owner)
       VALUES ($1, $2, $3, '', $4, $5, $6, $7)
       RETURNING id, name, email, role, clinic_id, is_owner`,
      [name, email.toLowerCase(), passwordHash, resolvedRole, specialization || null, clinic_id, Boolean(is_owner)]
    );

    // Platform admin is creating an account for someone else — don't touch
    // the admin's own session (no cookie, no access token for the caller).
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("register error:", error.message);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.is_owner, u.password_hash,
              c.plan AS clinic_plan, c.features AS clinic_features
         FROM auth_users u
         LEFT JOIN clinics c ON c.id = u.clinic_id
        WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const publicUser = withClinicPlan(user);
    const accessToken = await startSession(req, res, publicUser);
    res.json({ success: true, accessToken, user: publicUser });
  } catch (error) {
    console.error("login error:", error.message);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

/**
 * POST /api/auth/refresh
 * Reads the refresh cookie, rotates it, returns a fresh access token.
 */
export const refresh = async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  try {
    const { userId, raw: nextRaw } = await rotateRefreshToken(raw, clientMeta(req));

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.is_owner,
              c.plan AS clinic_plan, c.features AS clinic_features
         FROM auth_users u
         LEFT JOIN clinics c ON c.id = u.clinic_id
        WHERE u.id = $1`,
      [userId]
    );
    if (rows.length === 0) {
      res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(req), maxAge: undefined });
      return res.status(401).json({ success: false, message: "Session invalid" });
    }

    const user = withClinicPlan(rows[0]);
    res.cookie(REFRESH_COOKIE, nextRaw, refreshCookieOptions(req));
    res.json({ success: true, accessToken: signAccessToken(user), user });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(req), maxAge: undefined });
    const message = err.code === "reused"
      ? "Session revoked — please sign in again"
      : "Session expired";
    return res.status(401).json({ success: false, message });
  }
};

/**
 * POST /api/auth/logout
 * Revokes the current refresh token and clears the cookie.
 */
export const logout = async (req, res) => {
  try {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  } catch {
    // best-effort
  }
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(req), maxAge: undefined });
  res.json({ success: true });
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
export const me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.is_owner, u.specialization,
              c.plan AS clinic_plan, c.features AS clinic_features
         FROM auth_users u
         LEFT JOIN clinics c ON c.id = u.clinic_id
        WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: withClinicPlan(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};
