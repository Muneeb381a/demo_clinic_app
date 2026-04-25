// src/scripts/setup.js — Creates all tables on a fresh DB (idempotent).
// Uses CREATE TABLE IF NOT EXISTS so it is completely safe to re-run.
// Run before seed.js: node src/scripts/setup.js

import dotenv from "dotenv";
dotenv.config();

import { pool } from "../models/db.js";

const TABLES = [
  // Extensions
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

  // Auth
  `CREATE TABLE IF NOT EXISTS auth_users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    salt          VARCHAR(64)   NOT NULL DEFAULT '',
    role          VARCHAR(50)   NOT NULL DEFAULT 'doctor',
    specialization VARCHAR(100),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )`,

  // Patients
  `CREATE TABLE IF NOT EXISTS patients (
    id           SERIAL PRIMARY KEY,
    mobile       VARCHAR(20),
    mr_no        VARCHAR(60) UNIQUE,
    name         VARCHAR(200),
    age          INTEGER,
    gender       VARCHAR(20),
    weight       NUMERIC(6,2),
    height       NUMERIC(6,2),
    checkup_date DATE DEFAULT CURRENT_DATE
  )`,

  // Consultations
  `CREATE TABLE IF NOT EXISTS consultations (
    id          SERIAL PRIMARY KEY,
    patient_id  INTEGER REFERENCES patients(id),
    doctor_name VARCHAR(200),
    visit_date  TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Vital Signs
  `CREATE TABLE IF NOT EXISTS vital_signs (
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
  )`,

  // Symptoms
  `CREATE TABLE IF NOT EXISTS symptoms (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(200) UNIQUE,
    is_custom BOOLEAN DEFAULT false
  )`,

  // Consultation ↔ Symptom
  `CREATE TABLE IF NOT EXISTS consultation_symptoms (
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    symptom_id      INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
    patient_id      INTEGER,
    PRIMARY KEY (consultation_id, symptom_id)
  )`,

  // Medicines
  `CREATE TABLE IF NOT EXISTS medicines (
    id           SERIAL PRIMARY KEY,
    brand_name   VARCHAR(200),
    generic_name VARCHAR(200),
    form         VARCHAR(50),
    strength     VARCHAR(100),
    urdu_name    VARCHAR(200),
    urdu_form    VARCHAR(100),
    urdu_strength VARCHAR(100)
  )`,

  // Prescriptions
  `CREATE TABLE IF NOT EXISTS prescriptions (
    id               SERIAL PRIMARY KEY,
    consultation_id  INTEGER REFERENCES consultations(id),
    patient_id       INTEGER REFERENCES patients(id),
    medicine_id      INTEGER REFERENCES medicines(id),
    dosage_en        VARCHAR(100),
    dosage_urdu      VARCHAR(200),
    frequency_en     VARCHAR(100),
    frequency_urdu   VARCHAR(200),
    duration_en      VARCHAR(100),
    duration_urdu    VARCHAR(200),
    instructions_en  TEXT,
    instructions_urdu TEXT,
    how_to_take_en   TEXT,
    how_to_take_urdu TEXT,
    prescribed_at    TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Tests
  `CREATE TABLE IF NOT EXISTS tests (
    id         SERIAL PRIMARY KEY,
    test_name  VARCHAR(200),
    test_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Consultation ↔ Test
  `CREATE TABLE IF NOT EXISTS consultation_tests (
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    test_id         INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (consultation_id, test_id)
  )`,

  // Neurological Exams
  `CREATE TABLE IF NOT EXISTS neurological_exams (
    id                     SERIAL PRIMARY KEY,
    patient_id             INTEGER REFERENCES patients(id),
    consultation_id        INTEGER REFERENCES consultations(id),
    motor_function         TEXT,
    muscle_tone            TEXT,
    muscle_strength        TEXT,
    deep_tendon_reflexes   TEXT,
    plantar_reflex         TEXT,
    sensory_examination    TEXT,
    pain_sensation         BOOLEAN DEFAULT false,
    vibration_sense        BOOLEAN DEFAULT false,
    proprioception         BOOLEAN DEFAULT false,
    temperature_sensation  BOOLEAN DEFAULT false,
    coordination           TEXT,
    finger_nose_test       TEXT,
    heel_shin_test         TEXT,
    gait_assessment        TEXT,
    romberg_test           TEXT,
    cranial_nerves         TEXT,
    pupillary_reaction     TEXT,
    eye_movements          TEXT,
    facial_sensation       BOOLEAN DEFAULT false,
    swallowing_function    BOOLEAN DEFAULT false,
    tongue_movement        TEXT,
    straight_leg_raise_test TEXT,
    lasegue_test           TEXT,
    brudzinski_sign        BOOLEAN DEFAULT false,
    kernig_sign            BOOLEAN DEFAULT false,
    cognitive_assessment   TEXT,
    speech_assessment      TEXT,
    straight_leg_raise_left  TEXT,
    straight_leg_raise_right TEXT,
    tremors                TEXT,
    involuntary_movements  TEXT,
    diagnosis              TEXT,
    treatment_plan         TEXT,
    notes                  TEXT,
    fundoscopy             TEXT,
    mmse_score             INTEGER,
    gcs_score              INTEGER,
    power                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Follow-Ups
  `CREATE TABLE IF NOT EXISTS follow_ups (
    id              SERIAL PRIMARY KEY,
    consultation_id INTEGER REFERENCES consultations(id),
    follow_up_date  DATE,
    notes           TEXT DEFAULT 'عام چیک اپ',
    is_completed    BOOLEAN DEFAULT false
  )`,

  // Medical Conditions
  `CREATE TABLE IF NOT EXISTS medical_conditions (
    id             SERIAL PRIMARY KEY,
    patient_id     INTEGER REFERENCES patients(id),
    condition_name VARCHAR(200),
    duration       VARCHAR(100),
    diagnosis_date DATE,
    notes          TEXT
  )`,

  // Chatbot Cache
  `CREATE TABLE IF NOT EXISTS chatbot_cache (
    input_hash   VARCHAR(40) PRIMARY KEY,
    keyword_hash VARCHAR(40),
    response     JSONB       NOT NULL,
    input_sample TEXT,
    hit_count    INT         DEFAULT 1,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
  )`,

  // Diseases
  `CREATE TABLE IF NOT EXISTS diseases (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL UNIQUE,
    icd10_code  VARCHAR(20),
    category    VARCHAR(100),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Disease → Symptom
  `CREATE TABLE IF NOT EXISTS disease_symptoms (
    disease_id INTEGER NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    symptom_id INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
    weight     NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (weight BETWEEN 0.01 AND 1.00),
    PRIMARY KEY (disease_id, symptom_id)
  )`,

  // Disease → Medicine
  `CREATE TABLE IF NOT EXISTS disease_medicines (
    disease_id   INTEGER  NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    medicine_id  INTEGER  NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    rank         SMALLINT NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 10),
    is_first_line BOOLEAN NOT NULL DEFAULT false,
    frequency    INTEGER  NOT NULL DEFAULT 0,
    PRIMARY KEY (disease_id, medicine_id)
  )`,

  // Disease → Test
  `CREATE TABLE IF NOT EXISTS disease_tests (
    disease_id  INTEGER  NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    test_id     INTEGER  NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    rank        SMALLINT NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 10),
    is_essential BOOLEAN NOT NULL DEFAULT false,
    frequency   INTEGER  NOT NULL DEFAULT 0,
    PRIMARY KEY (disease_id, test_id)
  )`,

  // Symptom Aliases
  `CREATE TABLE IF NOT EXISTS symptom_aliases (
    id         SERIAL PRIMARY KEY,
    symptom_id INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
    alias      VARCHAR(200) NOT NULL,
    language   VARCHAR(10)  NOT NULL DEFAULT 'en'
  )`,

  // Suggestion Feedback
  `CREATE TABLE IF NOT EXISTS suggestion_feedback (
    id                    SERIAL PRIMARY KEY,
    consultation_id       INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
    symptom_ids           INTEGER[] NOT NULL,
    suggested_disease_ids INTEGER[],
    accepted_medicine_ids INTEGER[] NOT NULL DEFAULT '{}',
    dismissed_medicine_ids INTEGER[] NOT NULL DEFAULT '{}',
    accepted_test_ids     INTEGER[] NOT NULL DEFAULT '{}',
    dismissed_test_ids    INTEGER[] NOT NULL DEFAULT '{}',
    processed             BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Neuro option lookup tables
  ...([
    "motor_function_options", "muscle_tone_options", "muscle_strength_options",
    "deep_tendon_reflexes_options", "plantar_reflex_options", "pupillary_reaction_options",
    "speech_assessment_options", "gait_assessment_options", "coordination_options",
    "sensory_examination_options", "cranial_nerves_options", "mental_status_options",
    "cerebellar_function_options", "muscle_wasting_options", "abnormal_movements_options",
    "romberg_test_options", "nystagmus_options", "fundoscopy_options",
    "straight_leg_raise_left_options", "straight_leg_raise_right_options",
  ].map((t) => `CREATE TABLE IF NOT EXISTS ${t} (
    id    SERIAL PRIMARY KEY,
    value VARCHAR(200) NOT NULL UNIQUE
  )`)),

  // Performance indexes
  `CREATE INDEX IF NOT EXISTS idx_patients_mobile          ON patients(mobile)`,
  `CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_consultations_visit_date ON consultations(visit_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_vital_signs_consultation ON vital_signs(consultation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vital_signs_patient      ON vital_signs(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prescriptions_consult    ON prescriptions(consultation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prescriptions_medicine   ON prescriptions(medicine_id)`,
  `CREATE INDEX IF NOT EXISTS idx_consult_symptoms_consult ON consultation_symptoms(consultation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_consult_tests_consult    ON consultation_tests(consultation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_follow_ups_consult       ON follow_ups(consultation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_follow_ups_date          ON follow_ups(follow_up_date)`,
  `CREATE INDEX IF NOT EXISTS idx_chatbot_cache_keyword    ON chatbot_cache(keyword_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_chatbot_cache_expires    ON chatbot_cache(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_users_email         ON auth_users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_diseases_category        ON diseases(category)`,
  `CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_unprocessed
     ON suggestion_feedback(processed) WHERE processed = false`,
  // Trigram indexes (require pg_trgm — created first above)
  `CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
     ON patients USING GIN (name gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_diseases_name_trgm
     ON diseases USING GIN (name gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_symptom_aliases_alias
     ON symptom_aliases USING GIN (alias gin_trgm_ops)`,
];

async function setup() {
  console.log("\n🏗  Setting up database tables...\n");
  const client = await pool.connect();
  try {
    for (const sql of TABLES) {
      await client.query(sql);
    }
    console.log(`  ✓ ${TABLES.length} statements executed (tables + indexes)\n`);
    console.log("✅ Setup complete. Run 'npm run seed' to populate demo data.\n");
  } catch (err) {
    console.error("\n❌ Setup failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
