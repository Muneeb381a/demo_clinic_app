// src/db/migrate.js
// Minimal forward-only SQL migration runner. No extra dependency — uses the
// existing pg pool. Each migrations/*.sql file runs once, inside a transaction,
// and is recorded in the schema_migrations table.
//
//   npm run migrate            apply every pending migration
//   npm run migrate:status     list applied vs pending, then exit
//   npm run migrate:baseline   record all current files as applied WITHOUT
//                              running them — use once when adopting this
//                              runner on a database that already has the schema
//
// Seed DATA is not a migration; it lives in migrations/seeds/ and is applied
// by `npm run seed`.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../models/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

const listMigrationFiles = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // zero-padded numeric prefixes sort lexicographically

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const appliedVersions = async (client) => {
  const { rows } = await client.query("SELECT version FROM schema_migrations");
  return new Set(rows.map((r) => r.version));
};

const runStatus = async () => {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedVersions(client);
    const files = listMigrationFiles();
    console.log(`\nMigrations (${MIGRATIONS_DIR}):\n`);
    for (const f of files) {
      console.log(`  ${applied.has(f) ? "✓ applied " : "· pending "}  ${f}`);
    }
    const pending = files.filter((f) => !applied.has(f));
    console.log(`\n${pending.length} pending, ${applied.size} applied.\n`);
  } finally {
    client.release();
  }
};

const runBaseline = async () => {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedVersions(client);
    const files = listMigrationFiles().filter((f) => !applied.has(f));
    if (files.length === 0) {
      console.log("Nothing to baseline — all files already recorded.");
      return;
    }
    await client.query("BEGIN");
    for (const f of files) {
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [f]);
      console.log(`  recorded (not run): ${f}`);
    }
    await client.query("COMMIT");
    console.log(`\nBaselined ${files.length} file(s). Future files will run normally.\n`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const runMigrate = async () => {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedVersions(client);
    const pending = listMigrationFiles().filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("Database is up to date — no pending migrations.");
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`  applying ${file} ... `);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log("ok");
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("FAILED");
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    console.log(`\nApplied ${pending.length} migration(s).\n`);
  } finally {
    client.release();
  }
};

const main = async () => {
  const mode = process.argv[2];
  try {
    if (mode === "--status") await runStatus();
    else if (mode === "--baseline") await runBaseline();
    else await runMigrate();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ${err.message}\n`);
    await pool.end();
    process.exit(1);
  }
};

main();
