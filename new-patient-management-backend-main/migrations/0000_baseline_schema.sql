-- =============================================================================
-- 0000_baseline_schema
-- =============================================================================
-- Complete current schema, consolidated from the three places DDL used to live:
--   * src/scripts/setup.js          (core + disease-graph + neuro-option tables)
--   * src/models/db.js ensureIndexes()  (performance indexes, ran every cold start)
--   * migrations/001_* and 002_*    (auth_users, disease graph, feedback function)
--
-- Every statement is IF NOT EXISTS / CREATE OR REPLACE, so this file is a safe
-- no-op against the existing production database and a full build against a
-- fresh one. New schema changes go in NEW numbered files (0001_, 0002_, ...).
-- Seed DATA lives in migrations/seeds/ and is applied by `npm run seed`.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Auth ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  salt           VARCHAR(64)  NOT NULL DEFAULT '',
  role           VARCHAR(50)  NOT NULL DEFAULT 'doctor',
  specialization VARCHAR(100),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Core clinical tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id           SERIAL PRIMARY KEY,
  mobile       VARCHAR(20),
  mr_no        VARCHAR(60) UNIQUE,
  name         VARCHAR(200),
  age          INTEGER,
  gender       VARCHAR(20),
  weight       NUMERIC(6,2),
  height       NUMERIC(6,2),
  checkup_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS consultations (
  id          SERIAL PRIMARY KEY,
  patient_id  INTEGER REFERENCES patients(id),
  doctor_name VARCHAR(200),
  visit_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vital_signs (
  id              SERIAL PRIMARY KEY,
  consultation_id INTEGER REFERENCES consultations(id),
  patient_id      INTEGER REFERENCES patients(id),
  pulse_rate      VARCHAR(20),
  blood_pressure  VARCHAR(30),
  temperature     VARCHAR(20),
  spo2_level      VARCHAR(20),
  nihss_score     INTEGER,
  fall_assessment VARCHAR(100),
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS symptoms (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(200) UNIQUE,
  is_custom BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS consultation_symptoms (
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  symptom_id      INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  patient_id      INTEGER,
  PRIMARY KEY (consultation_id, symptom_id)
);

CREATE TABLE IF NOT EXISTS medicines (
  id            SERIAL PRIMARY KEY,
  brand_name    VARCHAR(200),
  generic_name  VARCHAR(200),
  form          VARCHAR(50),
  strength      VARCHAR(100),
  urdu_name     VARCHAR(200),
  urdu_form     VARCHAR(100),
  urdu_strength VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id                SERIAL PRIMARY KEY,
  consultation_id   INTEGER REFERENCES consultations(id),
  patient_id        INTEGER REFERENCES patients(id),
  medicine_id       INTEGER REFERENCES medicines(id),
  dosage_en         VARCHAR(100),
  dosage_urdu       VARCHAR(200),
  frequency_en      VARCHAR(100),
  frequency_urdu    VARCHAR(200),
  duration_en       VARCHAR(100),
  duration_urdu     VARCHAR(200),
  instructions_en   TEXT,
  instructions_urdu TEXT,
  how_to_take_en    TEXT,
  how_to_take_urdu  TEXT,
  prescribed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tests (
  id         SERIAL PRIMARY KEY,
  test_name  VARCHAR(200),
  test_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultation_tests (
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  test_id         INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (consultation_id, test_id)
);

CREATE TABLE IF NOT EXISTS neurological_exams (
  id                       SERIAL PRIMARY KEY,
  patient_id               INTEGER REFERENCES patients(id),
  consultation_id          INTEGER REFERENCES consultations(id),
  motor_function           TEXT,
  muscle_tone              TEXT,
  muscle_strength          TEXT,
  deep_tendon_reflexes     TEXT,
  plantar_reflex           TEXT,
  sensory_examination      TEXT,
  pain_sensation           BOOLEAN DEFAULT false,
  vibration_sense          BOOLEAN DEFAULT false,
  proprioception           BOOLEAN DEFAULT false,
  temperature_sensation    BOOLEAN DEFAULT false,
  coordination             TEXT,
  finger_nose_test         TEXT,
  heel_shin_test           TEXT,
  gait_assessment          TEXT,
  romberg_test             TEXT,
  cranial_nerves           TEXT,
  pupillary_reaction       TEXT,
  eye_movements            TEXT,
  facial_sensation         BOOLEAN DEFAULT false,
  swallowing_function      BOOLEAN DEFAULT false,
  tongue_movement          TEXT,
  straight_leg_raise_test  TEXT,
  lasegue_test             TEXT,
  brudzinski_sign          BOOLEAN DEFAULT false,
  kernig_sign              BOOLEAN DEFAULT false,
  cognitive_assessment     TEXT,
  speech_assessment        TEXT,
  straight_leg_raise_left  TEXT,
  straight_leg_raise_right TEXT,
  tremors                  TEXT,
  involuntary_movements    TEXT,
  diagnosis                TEXT,
  treatment_plan           TEXT,
  notes                    TEXT,
  fundoscopy               TEXT,
  mmse_score               INTEGER,
  gcs_score                INTEGER,
  power                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id              SERIAL PRIMARY KEY,
  consultation_id INTEGER REFERENCES consultations(id),
  follow_up_date  DATE,
  notes           TEXT DEFAULT 'عام چیک اپ',
  is_completed    BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS medical_conditions (
  id             SERIAL PRIMARY KEY,
  patient_id     INTEGER REFERENCES patients(id),
  condition_name VARCHAR(200),
  duration       VARCHAR(100),
  diagnosis_date DATE,
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS chatbot_cache (
  input_hash   VARCHAR(40) PRIMARY KEY,
  keyword_hash VARCHAR(40),
  response     JSONB       NOT NULL,
  input_sample TEXT,
  hit_count    INT         DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- ── Disease knowledge graph (smart-prescription assistant) ───────────────────
CREATE TABLE IF NOT EXISTS diseases (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL UNIQUE,
  icd10_code  VARCHAR(20),
  category    VARCHAR(100),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disease_symptoms (
  disease_id INTEGER NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
  symptom_id INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  weight     NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (weight BETWEEN 0.01 AND 1.00),
  PRIMARY KEY (disease_id, symptom_id)
);

CREATE TABLE IF NOT EXISTS disease_medicines (
  disease_id    INTEGER  NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
  medicine_id   INTEGER  NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  rank          SMALLINT NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 10),
  is_first_line BOOLEAN  NOT NULL DEFAULT false,
  frequency     INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (disease_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS disease_tests (
  disease_id   INTEGER  NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
  test_id      INTEGER  NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  rank         SMALLINT NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 10),
  is_essential BOOLEAN  NOT NULL DEFAULT false,
  frequency    INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (disease_id, test_id)
);

CREATE TABLE IF NOT EXISTS symptom_aliases (
  id         SERIAL PRIMARY KEY,
  symptom_id INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  alias      VARCHAR(200) NOT NULL,
  language   VARCHAR(10)  NOT NULL DEFAULT 'en'
);

CREATE TABLE IF NOT EXISTS suggestion_feedback (
  id                     SERIAL PRIMARY KEY,
  consultation_id        INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
  symptom_ids            INTEGER[] NOT NULL,
  suggested_disease_ids  INTEGER[],
  accepted_medicine_ids  INTEGER[] NOT NULL DEFAULT '{}',
  dismissed_medicine_ids INTEGER[] NOT NULL DEFAULT '{}',
  accepted_test_ids      INTEGER[] NOT NULL DEFAULT '{}',
  dismissed_test_ids     INTEGER[] NOT NULL DEFAULT '{}',
  processed              BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Neuro-exam option lookup tables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS motor_function_options          (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS muscle_tone_options             (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS muscle_strength_options         (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS deep_tendon_reflexes_options    (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS plantar_reflex_options          (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS pupillary_reaction_options      (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS speech_assessment_options       (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS gait_assessment_options         (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS coordination_options            (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS sensory_examination_options     (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS cranial_nerves_options          (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS mental_status_options           (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS cerebellar_function_options     (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS muscle_wasting_options          (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS abnormal_movements_options      (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS romberg_test_options            (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS nystagmus_options              (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS fundoscopy_options              (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS straight_leg_raise_left_options (id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS straight_leg_raise_right_options(id SERIAL PRIMARY KEY, value VARCHAR(200) NOT NULL UNIQUE);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_mobile              ON patients(mobile);
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm           ON patients USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id     ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_visit_date     ON consultations(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_visit  ON consultations(patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_vital_signs_consultation     ON vital_signs(consultation_id);
CREATE INDEX IF NOT EXISTS idx_vital_signs_patient          ON vital_signs(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consult        ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medicine       ON prescriptions(medicine_id);
CREATE INDEX IF NOT EXISTS idx_consult_symptoms_consult     ON consultation_symptoms(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consult_symptoms_symptom     ON consultation_symptoms(symptom_id);
CREATE INDEX IF NOT EXISTS idx_consult_tests_consult        ON consultation_tests(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consult_tests_test           ON consultation_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_neuro_exams_consult          ON neurological_exams(consultation_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_consult           ON follow_ups(consultation_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date              ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_symptoms_name               ON symptoms(name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_chatbot_cache_keyword        ON chatbot_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_chatbot_cache_expires        ON chatbot_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_users_email             ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_diseases_category            ON diseases(category);
CREATE INDEX IF NOT EXISTS idx_diseases_name_trgm           ON diseases USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_disease_symptoms_symptom     ON disease_symptoms(symptom_id);
CREATE INDEX IF NOT EXISTS idx_disease_medicines_medicine   ON disease_medicines(medicine_id);
CREATE INDEX IF NOT EXISTS idx_disease_tests_test           ON disease_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_symptom_aliases_symptom      ON symptom_aliases(symptom_id);
CREATE INDEX IF NOT EXISTS idx_symptom_aliases_alias        ON symptom_aliases USING GIN (alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_unprocessed
  ON suggestion_feedback(processed) WHERE processed = false;

-- ── Feedback-learning function (from migration 002) ─────────────────────────
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
    IF rec.suggested_disease_ids IS NOT NULL AND array_length(rec.accepted_medicine_ids, 1) > 0 THEN
      FOREACH dis_id IN ARRAY rec.suggested_disease_ids LOOP
        FOREACH med_id IN ARRAY rec.accepted_medicine_ids LOOP
          UPDATE disease_medicines SET frequency = frequency + 1
           WHERE disease_id = dis_id AND medicine_id = med_id;
        END LOOP;
      END LOOP;
    END IF;

    IF rec.suggested_disease_ids IS NOT NULL AND array_length(rec.accepted_test_ids, 1) > 0 THEN
      FOREACH dis_id IN ARRAY rec.suggested_disease_ids LOOP
        FOREACH tst_id IN ARRAY rec.accepted_test_ids LOOP
          UPDATE disease_tests SET frequency = frequency + 1
           WHERE disease_id = dis_id AND test_id = tst_id;
        END LOOP;
      END LOOP;
    END IF;

    UPDATE suggestion_feedback SET processed = true WHERE id = rec.id;
    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$ LANGUAGE plpgsql;
