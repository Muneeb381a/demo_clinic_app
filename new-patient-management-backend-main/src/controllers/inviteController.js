// src/controllers/inviteController.js
// Public endpoints for the invite-acceptance flow — a new staff member
// clicks the link a clinic owner shared and sets their own password.

import { pool } from "../models/db.js";
import bcrypt from "bcryptjs";
import { findPendingInvite, markInviteAccepted } from "../services/invites.js";
import { startSession, withClinicPlan } from "./authController.js";

const BCRYPT_ROUNDS = 12;

/**
 * GET /api/auth/invite/:token
 * Lets the accept-invite page show who/what this invite is for before the
 * new user commits to a password.
 */
export const getInvite = async (req, res) => {
  const invite = await findPendingInvite(req.params.token);
  if (!invite) {
    return res.status(404).json({ success: false, message: "This invite link is invalid or has expired" });
  }
  res.json({
    success: true,
    invite: { email: invite.email, role: invite.role, clinicName: invite.clinic_name },
  });
};

/**
 * POST /api/auth/accept-invite
 * Body: { token, name, password }
 * Creates the staff account, marks the invite used, and starts a session —
 * same shape as login/register.
 */
export const acceptInvite = async (req, res) => {
  const { token, name, password } = req.body;
  if (!token || !name || !password) {
    return res.status(400).json({ success: false, message: "token, name and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Re-validate inside the transaction — the invite could have been used
    // or cancelled between GET /invite/:token and this submit.
    const invite = await findPendingInvite(token, client);
    if (!invite) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "This invite link is invalid or has expired" });
    }

    const existing = await client.query("SELECT id FROM auth_users WHERE email = $1", [invite.email]);
    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "An account already exists for this email" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await client.query(
      `INSERT INTO auth_users (name, email, password_hash, salt, role, clinic_id, is_owner)
       VALUES ($1, $2, $3, '', $4, $5, false)
       RETURNING id, name, email, role, clinic_id, is_owner`,
      [name, invite.email, passwordHash, invite.role, invite.clinic_id]
    );
    await markInviteAccepted(invite.id, client);

    await client.query("COMMIT");

    const user = withClinicPlan({
      ...result.rows[0],
      clinic_plan: invite.clinic_plan,
      clinic_features: invite.clinic_features,
    });
    const accessToken = await startSession(req, res, user);
    res.status(201).json({ success: true, accessToken, user });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("acceptInvite error:", error.message);
    res.status(500).json({ success: false, message: "Failed to accept invite" });
  } finally {
    client.release();
  }
};
