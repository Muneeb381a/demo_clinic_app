// src/controllers/authController.js
import { pool } from "../models/db.js";
import { signToken } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Creates a new doctor account.
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
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({ success: true, token, user });
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

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("login error:", error.message);
    res.status(500).json({ success: false, message: "Login failed" });
  }
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
