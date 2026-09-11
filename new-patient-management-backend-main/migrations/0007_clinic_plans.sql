-- =============================================================================
-- 0007_clinic_plans
-- =============================================================================
-- Lets the platform admin give a clinic a named plan ('clinic' | 'hospital')
-- that presets its seat limits (max_doctors/max_receptionists, already on
-- this table) and which optional modules are turned on (the new `features`
-- column). The preset table itself lives in code (src/config/plans.js), not
-- the DB — `plan` here is just a label; `features` holds the actual, always-
-- editable-afterward flags a clinic currently has, same as max_doctors
-- already works.
--
-- Existing clinics default to plan='clinic' with an empty features object
-- (== every flag off) — a conscious choice: an already-provisioned clinic
-- keeps behaving exactly as it did before this migration until a platform
-- admin explicitly sets its plan/features via PATCH /api/platform/clinics/:id.
-- =============================================================================

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan     VARCHAR(20) NOT NULL DEFAULT 'clinic';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS features JSONB       NOT NULL DEFAULT '{}'::jsonb;
