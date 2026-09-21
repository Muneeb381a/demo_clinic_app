-- =============================================================================
-- 0008_billing
-- =============================================================================
-- Phase 1 of the hospital layer: per-doctor fees (with visiting-doctor share
-- split), a services catalogue, and OPD bills/receipts with payments.
-- Everything is clinic-scoped (clinic_id) like patients are. Money is
-- NUMERIC(12,2). bill_items freeze the price and the doctor/hospital split at
-- billing time, so later fee edits never rewrite history.
-- Gated per clinic by the `billing` feature flag (src/config/plans.js).
-- =============================================================================

CREATE TABLE IF NOT EXISTS doctor_fees (
  id                 SERIAL PRIMARY KEY,
  clinic_id          INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id          INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  doctor_type        VARCHAR(20) NOT NULL DEFAULT 'staff',   -- 'staff' | 'visiting'
  consultation_fee   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (consultation_fee >= 0),
  followup_fee       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (followup_fee >= 0),
  hospital_share_pct NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (hospital_share_pct BETWEEN 0 AND 100),
  doctor_share_pct   NUMERIC(5,2)  NOT NULL DEFAULT 100 CHECK (doctor_share_pct BETWEEN 0 AND 100),
  CHECK (doctor_type IN ('staff', 'visiting')),
  CHECK (hospital_share_pct + doctor_share_pct = 100),
  UNIQUE (clinic_id, doctor_id)
);

CREATE TABLE IF NOT EXISTS services (
  id         SERIAL PRIMARY KEY,
  clinic_id  INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  category   VARCHAR(30)  NOT NULL DEFAULT 'other',  -- procedure | lab | radiology | other
  price      NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  active     BOOLEAN NOT NULL DEFAULT true,
  CHECK (category IN ('procedure', 'lab', 'radiology', 'other'))
);
CREATE INDEX IF NOT EXISTS idx_services_clinic ON services(clinic_id);

-- Gap-free per-clinic bill numbering: bumped inside the bill transaction.
CREATE TABLE IF NOT EXISTS bill_counters (
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  kind      VARCHAR(10) NOT NULL,
  last_no   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, kind)
);

CREATE TABLE IF NOT EXISTS bills (
  id              SERIAL PRIMARY KEY,
  clinic_id       INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  bill_no         VARCHAR(30) NOT NULL,
  kind            VARCHAR(10) NOT NULL DEFAULT 'opd',
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  consultation_id INTEGER REFERENCES consultations(id),
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  paid            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  status          VARCHAR(10) NOT NULL DEFAULT 'unpaid',  -- unpaid | partial | paid | void
  created_by      INTEGER REFERENCES auth_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at       TIMESTAMPTZ,
  CHECK (status IN ('unpaid', 'partial', 'paid', 'void')),
  UNIQUE (clinic_id, bill_no)
);
CREATE INDEX IF NOT EXISTS idx_bills_clinic_created ON bills(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patient_id);

CREATE TABLE IF NOT EXISTS bill_items (
  id                    SERIAL PRIMARY KEY,
  bill_id               INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  kind                  VARCHAR(20) NOT NULL,        -- consultation | followup | service
  doctor_id             INTEGER REFERENCES auth_users(id),
  service_id            INTEGER REFERENCES services(id),
  description           VARCHAR(300) NOT NULL,
  qty                   INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price            NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  doctor_share_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  hospital_share_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  CHECK (kind IN ('consultation', 'followup', 'service'))
);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_doctor ON bill_items(doctor_id);

CREATE TABLE IF NOT EXISTS payments (
  id          SERIAL PRIMARY KEY,
  bill_id     INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method      VARCHAR(10) NOT NULL DEFAULT 'cash',
  reference   VARCHAR(100),
  received_by INTEGER REFERENCES auth_users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (method IN ('cash', 'card', 'online'))
);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
