-- =============================================================================
-- 0003_enforce_patient_ownership
-- =============================================================================
-- Make ownership mandatory. Apply this only after the code from 0001 (which
-- sets doctor_id / created_by on every insert) is live in production — every
-- insert path in the app now populates both columns.
--
-- Belt and braces: re-run the backfill first so a stray NULL from the
-- transition window can't fail the NOT NULL.
-- =============================================================================

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

ALTER TABLE patients      ALTER COLUMN doctor_id  SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN created_by SET NOT NULL;
