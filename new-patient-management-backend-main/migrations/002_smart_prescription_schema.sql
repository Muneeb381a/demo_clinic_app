-- =============================================================================
-- Migration 002: Smart Prescription Assistant Schema
-- =============================================================================
-- Run this ONCE against your PostgreSQL database after migration 001.
-- It adds the disease knowledge graph that powers symptom → medicine/test
-- suggestions, plus a feedback table for learning from doctor decisions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DISEASES
-- Central disease catalog with ICD-10 classification.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diseases (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL UNIQUE,
  icd10_code  VARCHAR(20),                     -- e.g. 'J06.9', 'K29.7'
  category    VARCHAR(100),                    -- 'Respiratory', 'GI', 'Neurological', …
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diseases_category ON diseases (category);
CREATE INDEX IF NOT EXISTS idx_diseases_name_trgm ON diseases USING GIN (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 2. SYMPTOM → DISEASE MAPPING  (weighted)
-- weight: 0.0–1.0
--   1.0 = pathognomonic (this symptom almost always means this disease)
--   0.7 = highly associated
--   0.5 = moderately associated
--   0.3 = weakly associated / non-specific
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disease_symptoms (
  disease_id  INTEGER NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
  symptom_id  INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  weight      NUMERIC(3,2) NOT NULL DEFAULT 0.5
              CHECK (weight BETWEEN 0.01 AND 1.00),
  PRIMARY KEY (disease_id, symptom_id)
);

CREATE INDEX IF NOT EXISTS idx_disease_symptoms_symptom ON disease_symptoms (symptom_id);

-- -----------------------------------------------------------------------------
-- 3. DISEASE → MEDICINE MAPPING  (evidence-based)
-- rank:          1 = first-line choice, 2 = second-line, 3 = adjunct
-- is_first_line: true for primary treatment medicines
-- frequency:     auto-incremented by feedback loop (doctor acceptance counts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disease_medicines (
  disease_id    INTEGER NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  rank          SMALLINT NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 10),
  is_first_line BOOLEAN NOT NULL DEFAULT false,
  frequency     INTEGER NOT NULL DEFAULT 0,   -- incremented by feedback
  PRIMARY KEY (disease_id, medicine_id)
);

CREATE INDEX IF NOT EXISTS idx_disease_medicines_medicine ON disease_medicines (medicine_id);

-- -----------------------------------------------------------------------------
-- 4. DISEASE → TEST MAPPING
-- rank:         1 = essential/first-order, 2 = confirmatory, 3 = additional
-- is_essential: true for must-order tests
-- frequency:    auto-incremented by feedback
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disease_tests (
  disease_id  INTEGER NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
  test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  rank        SMALLINT NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 10),
  is_essential BOOLEAN NOT NULL DEFAULT false,
  frequency   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (disease_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_disease_tests_test ON disease_tests (test_id);

-- -----------------------------------------------------------------------------
-- 5. SYMPTOM ALIASES
-- Alternate names for a symptom (English synonyms + Urdu equivalents).
-- Powers richer text matching in the autocomplete endpoint.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS symptom_aliases (
  id          SERIAL PRIMARY KEY,
  symptom_id  INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  alias       VARCHAR(200) NOT NULL,
  language    VARCHAR(10) NOT NULL DEFAULT 'en'  -- 'en' | 'ur'
);

CREATE INDEX IF NOT EXISTS idx_symptom_aliases_symptom ON symptom_aliases (symptom_id);
CREATE INDEX IF NOT EXISTS idx_symptom_aliases_alias   ON symptom_aliases USING GIN (alias gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 6. SUGGESTION FEEDBACK  (learning loop)
-- Every time a doctor uses the suggestion panel and saves a prescription,
-- we log which suggestions were accepted (kept) and which were dismissed.
-- A nightly/periodic job reads this table to increment frequency counters
-- in disease_medicines and disease_tests, improving future rankings.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suggestion_feedback (
  id                    SERIAL PRIMARY KEY,
  consultation_id       INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
  symptom_ids           INTEGER[] NOT NULL,           -- what the doctor typed
  suggested_disease_ids INTEGER[],                    -- top diseases returned
  accepted_medicine_ids INTEGER[] NOT NULL DEFAULT '{}',  -- doctor KEPT these
  dismissed_medicine_ids INTEGER[] NOT NULL DEFAULT '{}', -- doctor REMOVED these
  accepted_test_ids     INTEGER[] NOT NULL DEFAULT '{}',
  dismissed_test_ids    INTEGER[] NOT NULL DEFAULT '{}',
  processed            BOOLEAN NOT NULL DEFAULT false, -- true after freq update job runs
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_unprocessed
  ON suggestion_feedback (processed) WHERE processed = false;

-- -----------------------------------------------------------------------------
-- 7. TRIGRAM EXTENSION (needed for gin_trgm_ops indexes above)
-- Safe to run multiple times.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- 8. FREQUENCY UPDATE FUNCTION
-- Call this from a Vercel cron or manually to process pending feedback and
-- update disease_medicines.frequency / disease_tests.frequency.
-- This is what makes the system "learn" from doctor decisions over time.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_suggestion_feedback()
RETURNS INTEGER AS $$
DECLARE
  rec    suggestion_feedback%ROWTYPE;
  cnt    INTEGER := 0;
  med_id INTEGER;
  tst_id INTEGER;
  dis_id INTEGER;
BEGIN
  FOR rec IN
    SELECT * FROM suggestion_feedback WHERE processed = false ORDER BY created_at ASC
  LOOP
    -- Increment frequency for each (disease, medicine) pair where:
    --   the disease was suggested AND the medicine was accepted
    IF rec.suggested_disease_ids IS NOT NULL AND array_length(rec.accepted_medicine_ids, 1) > 0 THEN
      FOREACH dis_id IN ARRAY rec.suggested_disease_ids LOOP
        FOREACH med_id IN ARRAY rec.accepted_medicine_ids LOOP
          UPDATE disease_medicines
             SET frequency = frequency + 1
           WHERE disease_id = dis_id AND medicine_id = med_id;
        END LOOP;
      END LOOP;
    END IF;

    -- Same for tests
    IF rec.suggested_disease_ids IS NOT NULL AND array_length(rec.accepted_test_ids, 1) > 0 THEN
      FOREACH dis_id IN ARRAY rec.suggested_disease_ids LOOP
        FOREACH tst_id IN ARRAY rec.accepted_test_ids LOOP
          UPDATE disease_tests
             SET frequency = frequency + 1
           WHERE disease_id = dis_id AND test_id = tst_id;
        END LOOP;
      END LOOP;
    END IF;

    -- Mark as processed
    UPDATE suggestion_feedback SET processed = true WHERE id = rec.id;
    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;  -- returns number of records processed
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE SEED DATA — common diseases, symptoms, medicines, tests
-- Replace $symptom_id / $medicine_id / $test_id with your real IDs.
--
-- Pattern for adding a disease:
--   INSERT INTO diseases (name, icd10_code, category) VALUES ('Flu', 'J11', 'Respiratory');
--
-- Pattern for mapping (use your real symptom/medicine/test IDs):
--   INSERT INTO disease_symptoms VALUES (1, 5, 0.9), (1, 3, 0.7), (1, 8, 0.5);
--   INSERT INTO disease_medicines VALUES (1, 12, 1, true, 0), (1, 7, 2, false, 0);
--   INSERT INTO disease_tests VALUES (1, 3, 1, true, 0), (1, 9, 2, false, 0);
-- =============================================================================
