import { pool } from "../models/db.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.js";

const NEURO_ALL_KEY = "neuro-options:all";
const NEURO_TTL = 3600; // 1 hour — neuro option lists almost never change

// Allowed fields for validation
const allowedFields = [
  "motor_function",
  "muscle_tone",
  "muscle_strength",
  "deep_tendon_reflexes",
  "plantar_reflex",
  "pupillary_reaction",
  "speech_assessment",
  "gait_assessment",
  "coordination",
  "sensory_examination",
  "cranial_nerves",
  "mental_status",
  "cerebellar_function",
  "muscle_wasting",
  "abnormal_movements",
  "romberg_test",
  "nystagmus",
  "fundoscopy",
  "straight_leg_raise_left",
  "straight_leg_raise_right",
];

const getTableName = (field) => {
  if (!allowedFields.includes(field)) return null;
  return `${field}_options`;
};


const setCORSHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

// GET Options Controller
export const getOptions = async (req, res) => {
  const { field } = req.params;
  const table = getTableName(field);

  if (!table) {
    return res.status(400).json({ error: "Invalid field" });
  }

  setCORSHeaders(res);

  const cacheKey = `neuro-options:${field}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json({ data: cached });

    const result = await pool.query(
      `SELECT id, value FROM ${table} ORDER BY id`
    );

    if (!result.rows.length) {
      return res.status(200).json({ data: [], message: "No options found" });
    }

    await cacheSet(cacheKey, result.rows, NEURO_TTL);
    res.status(200).json({ data: result.rows });
  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET ALL Options (batch) — returns every field's options in one DB round-trip
// GET /api/neuro-options/all
export const getAllOptions = async (req, res) => {
  setCORSHeaders(res);
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=300");
  try {
    const cached = await cacheGet(NEURO_ALL_KEY);
    if (cached) return res.json(cached);

    // Fetch all 20 tables in a single query using UNION ALL
    const unionQuery = allowedFields
      .map((field) => `SELECT '${field}' AS field, id, value FROM ${field}_options`)
      .join(" UNION ALL ");

    const result = await pool.query(`${unionQuery} ORDER BY field, id`);

    // Group rows by field
    const grouped = {};
    for (const field of allowedFields) grouped[field] = [];
    for (const row of result.rows) {
      grouped[row.field].push({ id: row.id, value: row.value });
    }

    await cacheSet(NEURO_ALL_KEY, grouped, NEURO_TTL);
    res.json(grouped);
  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// ADD Option Controller
export const addOption = async (req, res) => {
  const { field } = req.params;
  const { value } = req.body;
  const table = getTableName(field);

  if (!table) {
    return res.status(400).json({ error: "Invalid field" });
  }

  if (!value || typeof value !== "string" || value.trim() === "") {
    return res.status(400).json({ error: "Value must be a non-empty string" });
  }

  const trimmedValue = value.trim();
  setCORSHeaders(res);

  // Check out a dedicated client so BEGIN/COMMIT run on the same connection
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockKey = `lock:${table}:${trimmedValue}`;
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [lockKey]
    );

    if (!lockResult.rows[0].locked) {
      await client.query("ROLLBACK");
      return res.status(503).json({ error: "Unable to acquire lock, try again later" });
    }

    const existing = await client.query(
      `SELECT id FROM ${table} WHERE value = $1 FOR UPDATE`,
      [trimmedValue]
    );

    if (existing.rows.length > 0) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
      await client.query("COMMIT");
      return res.status(409).json({ error: "Option already exists" });
    }

    const result = await client.query(
      `INSERT INTO ${table} (value) VALUES ($1) RETURNING id, value`,
      [trimmedValue]
    );

    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
    await client.query("COMMIT");

    // Invalidate both the individual field cache and the batch cache
    await Promise.all([
      cacheDel(`neuro-options:${field}`),
      cacheDel(NEURO_ALL_KEY),
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({
      error: "Server error while adding option",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  } finally {
    client.release();
  }
};

// Handle CORS preflight (OPTIONS) requests
export const handleOptions = (req, res) => {
  setCORSHeaders(res);
  res.status(200).end();
};