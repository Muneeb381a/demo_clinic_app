-- =============================================================================
-- 0009_ipd
-- =============================================================================
-- Phase 2 of the hospital layer: wards, beds, and inpatient admissions.
-- A bed's daily rate defaults to its ward's rate (override per bed possible).
-- bed_stays is the source of truth for "who was in which bed, when, at what
-- rate" — every admission has one open stay (to_at IS NULL) and a transfer
-- closes it and opens another. Phase 3 (IPD billing) prices room rent from
-- these rows, so the rate is snapshotted at the moment a stay begins.
-- Gated per clinic by the `ipd` feature flag (src/config/plans.js).
-- =============================================================================

CREATE TABLE IF NOT EXISTS wards (
  id         SERIAL PRIMARY KEY,
  clinic_id  INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  ward_type  VARCHAR(20) NOT NULL DEFAULT 'general',
  daily_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
  active     BOOLEAN NOT NULL DEFAULT true,
  CHECK (ward_type IN ('general', 'semi_private', 'private', 'icu', 'ccu', 'nicu', 'other')),
  UNIQUE (clinic_id, name)
);

CREATE TABLE IF NOT EXISTS beds (
  id                  SERIAL PRIMARY KEY,
  clinic_id           INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  ward_id             INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  bed_no              VARCHAR(30) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'available',
  daily_rate_override NUMERIC(12,2) CHECK (daily_rate_override >= 0),
  active              BOOLEAN NOT NULL DEFAULT true,
  CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance')),
  UNIQUE (ward_id, bed_no)
);
CREATE INDEX IF NOT EXISTS idx_beds_clinic ON beds(clinic_id);

CREATE TABLE IF NOT EXISTS admissions (
  id                SERIAL PRIMARY KEY,
  clinic_id         INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  admission_no      VARCHAR(30) NOT NULL,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  doctor_id         INTEGER REFERENCES auth_users(id),
  diagnosis         VARCHAR(500),
  status            VARCHAR(12) NOT NULL DEFAULT 'admitted',
  admitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharged_at     TIMESTAMPTZ,
  discharge_summary TEXT,
  created_by        INTEGER REFERENCES auth_users(id),
  CHECK (status IN ('admitted', 'discharged')),
  UNIQUE (clinic_id, admission_no)
);
CREATE INDEX IF NOT EXISTS idx_admissions_clinic_status ON admissions(clinic_id, status);
-- A patient can only be admitted once at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_admissions_one_active_per_patient
  ON admissions(patient_id) WHERE status = 'admitted';

CREATE TABLE IF NOT EXISTS bed_stays (
  id           SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  bed_id       INTEGER NOT NULL REFERENCES beds(id),
  daily_rate   NUMERIC(12,2) NOT NULL CHECK (daily_rate >= 0),
  from_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  to_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bed_stays_admission ON bed_stays(admission_id);
-- Belt and braces: a bed can hold at most one open stay, even under races.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bed_stays_one_open_per_bed
  ON bed_stays(bed_id) WHERE to_at IS NULL;
