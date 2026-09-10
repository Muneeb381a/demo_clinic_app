-- =============================================================================
-- 0001_add_patient_ownership
-- =============================================================================
-- Introduces per-doctor data isolation. Every patient belongs to the doctor
-- (auth_users row) who registered them; consultations record who created them.
-- Application code filters every patient/consultation query by the caller's
-- user id (admins excepted).
--
-- Backfill: existing rows are assigned to the lowest auth_users id (the first
-- registered doctor / demo account). If your database has multiple real
-- doctors with mixed historical data, DO NOT rely on this — reassign the
-- affected rows manually before enforcing NOT NULL in a later migration.
-- =============================================================================

ALTER TABLE patients      ADD COLUMN IF NOT EXISTS doctor_id  INTEGER REFERENCES auth_users(id);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES auth_users(id);

-- Backfill existing data to the first doctor (no-op if there are no users yet).
UPDATE patients
   SET doctor_id = (SELECT MIN(id) FROM auth_users)
 WHERE doctor_id IS NULL
   AND EXISTS (SELECT 1 FROM auth_users);

UPDATE consultations c
   SET created_by = p.doctor_id
  FROM patients p
 WHERE c.patient_id = p.id
   AND c.created_by IS NULL
   AND p.doctor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_doctor_id      ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_by ON consultations(created_by);

-- NOT NULL is intentionally deferred to a follow-up migration, applied only
-- after the code that always sets these columns is live in production.
