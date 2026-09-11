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
-- Existing clinics get backfilled to the 'clinic' plan's *feature* preset
-- (chatbot on, ai_suggestions/whatsapp_reminders off) rather than left at an
-- empty {} — before this migration the chatbot had no gate at all (always
-- on), so an empty features object would silently take it away from every
-- already-provisioned clinic the moment this ships. Seat limits are left
-- untouched either way (this migration never touches max_doctors/
-- max_receptionists) — a platform admin can still change any clinic's plan/
-- features afterward via PATCH /api/platform/clinics/:id.
-- =============================================================================

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan     VARCHAR(20) NOT NULL DEFAULT 'clinic';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS features JSONB       NOT NULL DEFAULT '{}'::jsonb;

UPDATE clinics
   SET features = '{"ai_suggestions": false, "chatbot": true, "whatsapp_reminders": false}'::jsonb
 WHERE features = '{}'::jsonb;
