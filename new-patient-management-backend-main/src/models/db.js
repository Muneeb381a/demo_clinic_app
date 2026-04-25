// db.js
import dotenv from "dotenv";
import pkg from "pg";
import { logger } from "../../logger.js";

dotenv.config({ path: "./.env" });

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: true } : false,

  // Serverless-optimized settings:
  min: 0,                    // Don't pre-create connections — create on demand only
  max: parseInt(process.env.DB_POOL_SIZE || "10", 10),
  idleTimeoutMillis: 10000,  // Close idle connections after 10s (Vercel functions die quickly)
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || "10000", 10),
  allowExitOnIdle: true,     // Allow the Node process to exit when pool is fully idle
  keepAlive: true,           // TCP keepalives — prevents firewalls from killing idle connections
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error", { error: err.message, code: err.code });
});

// Ensure performance indexes exist — safe to run every startup (IF NOT EXISTS is a no-op)
export const ensureIndexes = async () => {
  const indexes = [
    // Persistent chatbot response cache (30-day TTL, keyword + exact lookup)
    `CREATE TABLE IF NOT EXISTS chatbot_cache (
       input_hash   VARCHAR(40) PRIMARY KEY,
       keyword_hash VARCHAR(40),
       response     JSONB        NOT NULL,
       input_sample TEXT,
       hit_count    INT          DEFAULT 1,
       created_at   TIMESTAMPTZ  DEFAULT NOW(),
       expires_at   TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '30 days'
     )`,
    `CREATE INDEX IF NOT EXISTS idx_chatbot_cache_keyword ON chatbot_cache(keyword_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_chatbot_cache_expires ON chatbot_cache(expires_at)`,
    // Enable trigram extension for fast ILIKE / similarity queries on text columns
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
    // Patient search indexes — critical for 100k+ records
    `CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients USING GIN (name gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile)`,
    `CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consultations_visit_date ON consultations(visit_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consultations_patient_visit ON consultations(patient_id, visit_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_vital_signs_consultation_id ON vital_signs(consultation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vital_signs_patient_id ON vital_signs(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_medicine_id ON prescriptions(medicine_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_symptoms_consultation_id ON consultation_symptoms(consultation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_symptoms_symptom_id ON consultation_symptoms(symptom_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_tests_consultation_id ON consultation_tests(consultation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consultation_tests_test_id ON consultation_tests(test_id)`,
    `CREATE INDEX IF NOT EXISTS idx_neurological_exams_consultation_id ON neurological_exams(consultation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_follow_ups_consultation_id ON follow_ups(consultation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date)`,
    `CREATE INDEX IF NOT EXISTS idx_symptoms_name ON symptoms(name text_pattern_ops)`,
  ];
  for (const sql of indexes) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Non-fatal: log and continue — index may already exist under a different name
      logger.warn("Index creation skipped", { sql, error: err.message });
    }
  }
  logger.info("DB indexes verified");
};

const closeDB = async () => {
  try {
    await pool.end();
    logger.info("Database pool closed successfully");
  } catch (error) {
    logger.error("Error closing database pool", { error: error.message });
  }
};

export { pool, closeDB };
