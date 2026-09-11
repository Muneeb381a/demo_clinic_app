// src/services/refreshTokens.js
// Opaque, rotating refresh tokens with server-side storage and theft detection.
//
// The browser holds the raw token only in an httpOnly cookie. We persist just
// its SHA-256 hash. Every /auth/refresh rotates: the presented token is revoked
// and a fresh one issued. Presenting a token that is already revoked means it
// leaked — we revoke every token the user has and force a re-login.

import crypto from "crypto";
import { pool } from "../models/db.js";

export const REFRESH_COOKIE = "rt";
export const REFRESH_TTL_DAYS = 14;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newRawToken = () => crypto.randomBytes(48).toString("base64url");

/**
 * Cookie options for the refresh token. Scoped to the auth path only.
 *
 * `secure` is derived from the actual request, not NODE_ENV: a cookie marked
 * Secure is silently dropped by the browser over plain HTTP, so keying this
 * off an env var that can be (mis)configured to "production" in local dev —
 * as this project's own .env.example warns against — breaks login instead of
 * hardening it. req.secure honours `X-Forwarded-Proto` once `trust proxy` is
 * set (TRUST_PROXY=true on Vercel), so this is correct in both places.
 */
export const refreshCookieOptions = (req) => ({
  httpOnly: true,
  secure: Boolean(req?.secure || req?.headers?.["x-forwarded-proto"] === "https"),
  sameSite: "lax",
  path: "/api/auth",
  maxAge: REFRESH_TTL_MS,
});

/** Issue a brand-new refresh token for a user (login / register). */
export const issueRefreshToken = async (userId, { userAgent, ip } = {}) => {
  const raw = newRawToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, sha256(raw), userAgent?.slice(0, 500) ?? null, ip ?? null, expiresAt]
  );
  return { raw, expiresAt };
};

/**
 * Validate + rotate. Returns { userId, raw, expiresAt } on success.
 * Throws { code } — "invalid" | "expired" | "reused".
 */
export const rotateRefreshToken = async (rawToken, { userAgent, ip } = {}) => {
  if (!rawToken) throw Object.assign(new Error("no token"), { code: "invalid" });
  const hash = sha256(rawToken);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, user_id, expires_at, revoked_at
         FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hash]
    );
    const row = rows[0];

    if (!row) {
      await client.query("COMMIT");
      throw Object.assign(new Error("unknown token"), { code: "invalid" });
    }

    if (row.revoked_at) {
      // Reuse of a rotated/revoked token — treat as theft, nuke the family.
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [row.user_id]
      );
      await client.query("COMMIT");
      throw Object.assign(new Error("token reuse"), { code: "reused" });
    }

    if (new Date(row.expires_at) <= new Date()) {
      await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [row.id]);
      await client.query("COMMIT");
      throw Object.assign(new Error("expired"), { code: "expired" });
    }

    const raw = newRawToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const newHash = sha256(raw);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.user_id, newHash, userAgent?.slice(0, 500) ?? null, ip ?? null, expiresAt]
    );
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_hash = $2 WHERE id = $1`,
      [row.id, newHash]
    );
    await client.query("COMMIT");
    return { userId: row.user_id, raw, expiresAt };
  } catch (err) {
    if (!err.code) await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/** Revoke a single token (logout on this device). No error if it is unknown. */
export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken) return;
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    [sha256(rawToken)]
  );
};

/** Revoke every active token for a user (logout everywhere / password change). */
export const revokeAllForUser = async (userId) => {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId]
  );
};
