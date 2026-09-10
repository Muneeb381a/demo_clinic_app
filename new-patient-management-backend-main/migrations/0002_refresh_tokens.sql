-- =============================================================================
-- 0002_refresh_tokens
-- =============================================================================
-- Server-side refresh tokens for rotating auth. The browser only ever holds an
-- opaque token in an httpOnly cookie; we store its SHA-256 hash. Each use
-- rotates the token (old one revoked, new one issued). Presenting an already
-- revoked token is treated as theft and revokes the whole user's family.
-- =============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id               BIGSERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash       CHAR(64) NOT NULL UNIQUE,          -- sha256 hex
  replaced_by_hash CHAR(64),                          -- set when this token is rotated
  user_agent       TEXT,
  ip               INET,
  expires_at       TIMESTAMPTZ NOT NULL,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);
