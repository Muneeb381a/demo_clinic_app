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

// Schema (tables, indexes, the pg_trgm extension, the feedback function) is
// owned by migrations/ and applied with `npm run migrate` — never from the
// request or startup path. See migrations/README.md.

const closeDB = async () => {
  try {
    await pool.end();
    logger.info("Database pool closed successfully");
  } catch (error) {
    logger.error("Error closing database pool", { error: error.message });
  }
};

export { pool, closeDB };
