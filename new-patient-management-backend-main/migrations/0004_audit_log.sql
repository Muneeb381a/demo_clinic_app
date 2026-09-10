-- =============================================================================
-- 0004_audit_log
-- =============================================================================
-- Append-only access/change log. Every write (POST/PUT/DELETE) under /api and
-- every read of a sensitive record is recorded: who, when, from where, which
-- entity, and the outcome status. Request/response bodies are NOT stored — this
-- is an access trail, not a content copy, and bodies carry PHI.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
  action      VARCHAR(10)  NOT NULL,           -- HTTP method
  path        TEXT         NOT NULL,
  entity_type VARCHAR(40),                     -- 'patient' | 'consultation' | ...
  entity_id   VARCHAR(64),
  status      SMALLINT,                        -- response status code
  ip          INET,
  user_agent  TEXT,
  metadata    JSONB        NOT NULL DEFAULT '{}',
  request_id  UUID,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user     ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity   ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON audit_log(created_at DESC);
