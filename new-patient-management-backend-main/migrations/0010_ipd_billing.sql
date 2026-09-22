-- =============================================================================
-- 0010_ipd_billing
-- =============================================================================
-- Phase 3 of the hospital layer: advance deposits taken any time during a
-- stay, ad-hoc doctor-visit/service charges logged during a stay, and a
-- final IPD bill produced at discharge that reuses the existing
-- bills/bill_items/payments tables (kind='ipd', admission_id set) — so the
-- OPD billing endpoints (get/list/pay/void, the printable receipt) work for
-- IPD bills unchanged. Room rent is priced from bed_stays (Phase 2): one
-- bill_item per stay segment, days = ceil(hours/24) at that segment's
-- snapshotted daily_rate.
-- Gated by the same `ipd` feature flag as Phase 2.
-- =============================================================================

ALTER TABLE bills ADD COLUMN IF NOT EXISTS admission_id INTEGER REFERENCES admissions(id);
CREATE INDEX IF NOT EXISTS idx_bills_admission ON bills(admission_id);
-- One (non-void) bill per admission — void it to allow a corrected re-bill.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bills_one_active_per_admission
  ON bills(admission_id) WHERE admission_id IS NOT NULL AND status <> 'void';

-- bill_items.kind gains 'room_rent' alongside the OPD kinds.
ALTER TABLE bill_items DROP CONSTRAINT IF EXISTS bill_items_kind_check;
ALTER TABLE bill_items ADD CONSTRAINT bill_items_kind_check
  CHECK (kind IN ('consultation', 'followup', 'service', 'room_rent'));

CREATE TABLE IF NOT EXISTS admission_deposits (
  id               SERIAL PRIMARY KEY,
  clinic_id        INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  admission_id     INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method           VARCHAR(10) NOT NULL DEFAULT 'cash',
  reference        VARCHAR(100),
  received_by      INTEGER REFERENCES auth_users(id),
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_payment_id INTEGER REFERENCES payments(id),  -- set once folded into the final bill
  CHECK (method IN ('cash', 'card', 'online'))
);
CREATE INDEX IF NOT EXISTS idx_admission_deposits_admission ON admission_deposits(admission_id);

CREATE TABLE IF NOT EXISTS admission_charges (
  id          SERIAL PRIMARY KEY,
  clinic_id   INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  kind        VARCHAR(20) NOT NULL,           -- visit | service
  doctor_id   INTEGER REFERENCES auth_users(id),
  service_id  INTEGER REFERENCES services(id),
  description VARCHAR(300) NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price  NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  doctor_share_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES auth_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billed_item_id INTEGER REFERENCES bill_items(id),  -- set once folded into the final bill
  CHECK (kind IN ('visit', 'service'))
);
CREATE INDEX IF NOT EXISTS idx_admission_charges_admission ON admission_charges(admission_id);
