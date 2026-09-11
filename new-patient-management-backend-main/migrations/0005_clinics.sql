-- =============================================================================
-- 0005_clinics
-- =============================================================================
-- Introduces multi-tenancy. A clinic is the billing/access-control boundary:
-- staff (doctors + receptionists) belong to exactly one clinic, and every
-- patient belongs to exactly one clinic. Within a clinic, all staff share the
-- same patient pool — doctor_id / created_by on patients/consultations stay
-- as "who actually did this," not as the security boundary anymore.
--
-- role values from here on: 'doctor' | 'receptionist' | 'platform_admin'.
-- role is a plain VARCHAR (not a DB enum), so no type migration is needed to
-- introduce the new values.
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinics (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(200) NOT NULL,
  slug               VARCHAR(100) NOT NULL UNIQUE,
  max_doctors        INTEGER NOT NULL DEFAULT 1,
  max_receptionists  INTEGER NOT NULL DEFAULT 0,
  status             VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_owner  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE patients   ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);

-- Backfill: put all existing data into one default clinic so nothing currently
-- deployed loses access. The existing doctor(s) become that clinic's owner(s).
INSERT INTO clinics (name, slug, max_doctors, max_receptionists)
SELECT 'Default Clinic', 'default', GREATEST(5, (SELECT count(*) FROM auth_users WHERE role = 'doctor')), 5
WHERE EXISTS (SELECT 1 FROM auth_users)
  AND NOT EXISTS (SELECT 1 FROM clinics WHERE slug = 'default');

UPDATE auth_users
   SET clinic_id = (SELECT id FROM clinics WHERE slug = 'default'),
       is_owner  = true
 WHERE clinic_id IS NULL
   AND role <> 'platform_admin'
   AND EXISTS (SELECT 1 FROM clinics WHERE slug = 'default');

UPDATE patients p
   SET clinic_id = u.clinic_id
  FROM auth_users u
 WHERE p.doctor_id = u.id
   AND p.clinic_id IS NULL
   AND u.clinic_id IS NOT NULL;

-- Any patient whose doctor_id didn't resolve (orphaned data) still falls back
-- to the default clinic so nothing becomes permanently inaccessible.
UPDATE patients
   SET clinic_id = (SELECT id FROM clinics WHERE slug = 'default')
 WHERE clinic_id IS NULL
   AND EXISTS (SELECT 1 FROM clinics WHERE slug = 'default');

CREATE INDEX IF NOT EXISTS idx_auth_users_clinic ON auth_users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic    ON patients(clinic_id);

-- clinic_id NOT NULL is deferred to a later migration (0006), applied only
-- after the code that always sets it (this phase) is live — same pattern as
-- migration 0003 for doctor_id/created_by.
