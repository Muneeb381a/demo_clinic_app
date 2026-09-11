// src/controllers/clinicStaffController.js
// Clinic-owner staff management: invite doctors/receptionists into your own
// clinic, list them, remove them. Guarded by requireOwner (see routes).

import { pool } from "../models/db.js";
import { issueInvite, committedSeatCount } from "../services/invites.js";
import { revokeAllForUser } from "../services/refreshTokens.js";

/**
 * POST /api/clinic/invites
 * Body: { email, role }
 */
export const createInvite = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !["doctor", "receptionist"].includes(role)) {
      return res.status(400).json({ success: false, message: "email and a valid role ('doctor' or 'receptionist') are required" });
    }

    const clinicId = req.user.clinic_id;
    const clinic = await pool.query("SELECT max_doctors, max_receptionists FROM clinics WHERE id = $1", [clinicId]);
    if (!clinic.rowCount) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }
    const limit = role === "doctor" ? clinic.rows[0].max_doctors : clinic.rows[0].max_receptionists;

    const existing = await pool.query("SELECT id FROM auth_users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: "That email already has an account" });
    }

    const committed = await committedSeatCount(clinicId, role);
    if (committed >= limit) {
      return res.status(409).json({
        success: false,
        message: `Seat limit reached: ${committed}/${limit} ${role}${limit === 1 ? "" : "s"} already used or invited`,
      });
    }

    const invite = await issueInvite(clinicId, email, role, req.user.id);
    res.status(201).json({
      success: true,
      invite: { token: invite.raw, email: email.toLowerCase(), role, expiresAt: invite.expiresAt },
    });
  } catch (error) {
    console.error("createInvite error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create invite" });
  }
};

/**
 * GET /api/clinic/staff
 * Lists the clinic's staff plus any pending (unaccepted, unexpired) invites.
 */
export const listStaff = async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const staff = await pool.query(
      `SELECT id, name, email, role, is_owner, created_at
         FROM auth_users WHERE clinic_id = $1 ORDER BY is_owner DESC, created_at ASC`,
      [clinicId]
    );
    const pending = await pool.query(
      `SELECT id, email, role, expires_at, created_at
         FROM invites
        WHERE clinic_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC`,
      [clinicId]
    );
    res.json({ success: true, staff: staff.rows, pendingInvites: pending.rows });
  } catch (error) {
    console.error("listStaff error:", error.message);
    res.status(500).json({ success: false, message: "Failed to list staff" });
  }
};

/**
 * DELETE /api/clinic/staff/:id
 * Removes a staff member from the caller's own clinic and kills their
 * active sessions. Owners cannot remove themselves this way.
 */
export const removeStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ success: false, message: "You cannot remove your own account" });
    }
    const result = await pool.query(
      "DELETE FROM auth_users WHERE id = $1 AND clinic_id = $2 RETURNING id",
      [id, req.user.clinic_id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }
    await revokeAllForUser(id);
    res.json({ success: true });
  } catch (error) {
    console.error("removeStaff error:", error.message);
    res.status(500).json({ success: false, message: "Failed to remove staff member" });
  }
};

/**
 * DELETE /api/clinic/invites/:id
 * Cancels a pending invite (e.g. sent to the wrong email).
 */
export const cancelInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM invites WHERE id = $1 AND clinic_id = $2 AND accepted_at IS NULL RETURNING id",
      [id, req.user.clinic_id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("cancelInvite error:", error.message);
    res.status(500).json({ success: false, message: "Failed to cancel invite" });
  }
};
