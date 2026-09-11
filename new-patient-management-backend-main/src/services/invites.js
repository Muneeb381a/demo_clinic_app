// src/services/invites.js
// Clinic-owner staff invites. Same opaque-token pattern as refreshTokens.js:
// the raw token only ever exists in the shared link; we persist its SHA-256
// hash and never the raw value.

import crypto from "crypto";
import { pool } from "../models/db.js";

export const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newRawToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * Counts existing staff plus other pending (unexpired, unaccepted) invites
 * for a role, so seat limits can't be oversubscribed by inviting faster than
 * people accept.
 */
export const committedSeatCount = async (clinicId, role, client = pool) => {
  const { rows } = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM auth_users WHERE clinic_id = $1 AND role = $2) +
       (SELECT COUNT(*) FROM invites
          WHERE clinic_id = $1 AND role = $2 AND accepted_at IS NULL AND expires_at > NOW()
       ) AS count`,
    [clinicId, role]
  );
  return Number(rows[0].count);
};

/** Creates an invite row and returns the raw token (shown to the caller exactly once). */
export const issueInvite = async (clinicId, email, role, invitedBy, client = pool) => {
  const raw = newRawToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const { rows } = await client.query(
    `INSERT INTO invites (clinic_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [clinicId, email.toLowerCase(), role, sha256(raw), invitedBy, expiresAt]
  );
  return { id: rows[0].id, raw, expiresAt };
};

/** Looks up a pending invite by raw token. Returns null if unknown, expired, or already accepted. */
export const findPendingInvite = async (rawToken, client = pool) => {
  if (!rawToken) return null;
  const { rows } = await client.query(
    `SELECT i.id, i.clinic_id, i.email, i.role, i.expires_at, i.accepted_at, c.name AS clinic_name
       FROM invites i JOIN clinics c ON c.id = i.clinic_id
      WHERE i.token_hash = $1`,
    [sha256(rawToken)]
  );
  const invite = rows[0];
  if (!invite || invite.accepted_at || new Date(invite.expires_at) <= new Date()) return null;
  return invite;
};

/** Marks an invite accepted. Call inside the same transaction that creates the user. */
export const markInviteAccepted = async (inviteId, client) => {
  await client.query("UPDATE invites SET accepted_at = NOW() WHERE id = $1", [inviteId]);
};
