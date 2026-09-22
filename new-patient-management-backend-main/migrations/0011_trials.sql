-- =============================================================================
-- 0011_trials
-- =============================================================================
-- 7-day (configurable) demo trials for prospective customers. The timer
-- starts on the clinic's first successful login (src/controllers/
-- authController.js's startSession(), the shared chokepoint for login and
-- accept-invite), not at clinic creation — a demo clinic can sit unused for
-- days before the customer actually tries it.
--
-- Enforcement (requireTrialActive, src/middleware/clinicStatus.js) always
-- compares trial_ends_at against Postgres's own NOW() — never a client- or
-- Node-process-supplied timestamp — so nothing the trial user's own device
-- does (including changing its clock) can extend access.
--
-- Existing clinics: is_trial defaults false, so nothing changes for them.
-- =============================================================================

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS is_trial         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS trial_days       INTEGER NOT NULL DEFAULT 7 CHECK (trial_days > 0);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ;
