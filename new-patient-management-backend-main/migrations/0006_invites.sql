-- =============================================================================
-- 0006_invites
-- =============================================================================
-- A clinic owner invites their own staff (doctors / receptionists) without
-- the platform admin's involvement. Same opaque-token-hashed pattern as
-- refresh_tokens (migration 0002): the raw token exists only in the shared
-- link; we store its SHA-256 hash.
-- =============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id          SERIAL PRIMARY KEY,
  clinic_id   INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL CHECK (role IN ('doctor', 'receptionist')),
  token_hash  CHAR(64)     NOT NULL UNIQUE,
  invited_by  INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_clinic  ON invites(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invites_pending  ON invites(clinic_id, role) WHERE accepted_at IS NULL;
