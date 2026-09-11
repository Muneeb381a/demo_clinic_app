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

const clientMeta = (req) => ({
  userAgent: req.headers["user-agent"],
  ip: asInet(req.ip),
});

// Sets the rotating refresh cookie and returns the short-lived access token.
const startSession = async (req, res, user) => {
  const { raw } = await issueRefreshToken(user.id, clientMeta(req));
  res.cookie(REFRESH_COOKIE, raw, refreshCookieOptions(req));
  return signAccessToken(user);
};

/**
 * POST /api/auth/register
 * Body: { name, email, password, specialization }
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const existing = await pool.query("SELECT id FROM auth_users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO auth_users (name, email, password_hash, salt, role, specialization)
       VALUES ($1, $2, $3, '', 'doctor', $4) RETURNING id, name, email, role`,
      [name, email.toLowerCase(), passwordHash, specialization || null]
    );

    const user = result.rows[0];
    const accessToken = await startSession(req, res, user);

    res.status(201).json({ success: true, accessToken, user });
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
      "SELECT id, name, email, role, password_hash FROM auth_users WHERE email = $1",
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

    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
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
      "SELECT id, name, email, role FROM auth_users WHERE id = $1",
      [userId]
    );
    if (rows.length === 0) {
      res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(req), maxAge: undefined });
      return res.status(401).json({ success: false, message: "Session invalid" });
    }

    res.cookie(REFRESH_COOKIE, nextRaw, refreshCookieOptions(req));
    res.json({ success: true, accessToken: signAccessToken(rows[0]), user: rows[0] });
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
      "SELECT id, name, email, role, specialization FROM auth_users WHERE id = $1",
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};
