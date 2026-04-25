import { pool } from "../models/db.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.js";

const TEST_LIST_KEY = "tests:all";
const TEST_TTL = 600; // 10 minutes

export const createTest = async (req, res) => {
  try {
    const { test_name, test_notes } = req.body;
    const result = await pool.query(
      "INSERT INTO tests (test_name, test_notes) VALUES ($1, $2) RETURNING *",
      [test_name, test_notes]
    );
    await cacheDel(TEST_LIST_KEY);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding test:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllTests = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    const cached = await cacheGet(TEST_LIST_KEY);
    if (cached) return res.json(cached);

    const result = await pool.query(
      "SELECT id, test_name, test_notes, created_at FROM tests ORDER BY test_name ASC"
    );
    await cacheSet(TEST_LIST_KEY, result.rows, TEST_TTL);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching tests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const assignTestToConsultation = async (req, res) => {
  const { consultation_id, test_ids } = req.body;

  if (!consultation_id || !Array.isArray(test_ids) || !test_ids.length) {
    return res.status(400).json({ error: "consultation_id and test_ids array are required" });
  }

  for (const testId of test_ids) {
    if (!Number.isInteger(Number(testId))) {
      return res.status(400).json({ error: `Invalid test ID: ${testId}. Must be an integer.` });
    }
  }
  const parsedIds = test_ids.map(Number);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const consultationExists = await client.query(
      "SELECT 1 FROM consultations WHERE id = $1",
      [consultation_id]
    );
    if (!consultationExists.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Consultation not found" });
    }

    const testCheck = await client.query(
      "SELECT id, test_name FROM tests WHERE id = ANY($1::int[])",
      [parsedIds]
    );
    if (testCheck.rowCount !== parsedIds.length) {
      const validIds = new Set(testCheck.rows.map((r) => r.id));
      const invalid = parsedIds.filter((id) => !validIds.has(id));
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Test IDs do not exist: ${invalid.join(", ")}` });
    }

    await client.query("DELETE FROM consultation_tests WHERE consultation_id = $1", [consultation_id]);

    const valuePlaceholders = parsedIds.map((_, i) => `($1, $${i + 2}, NOW())`).join(", ");
    await client.query(
      `INSERT INTO consultation_tests (consultation_id, test_id, assigned_at) VALUES ${valuePlaceholders}`,
      [consultation_id, ...parsedIds]
    );

    await client.query("COMMIT");
    res.json({
      message: "Tests assigned successfully",
      consultation_id,
      assigned_tests: testCheck.rows.map((r) => ({ test_id: r.id, test_name: r.test_name })),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error assigning tests:", error.message);
    res.status(500).json({ error: "Failed to assign tests" });
  } finally {
    client.release();
  }
};

export const getTestsByPatient = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const result = await pool.query(
      `SELECT ct.test_id, t.test_name, ct.consultation_id, ct.assigned_at
       FROM consultation_tests ct
       JOIN consultations c ON ct.consultation_id = c.id
       JOIN tests t ON ct.test_id = t.id
       WHERE c.patient_id = $1
       ORDER BY ct.assigned_at DESC`,
      [patient_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No tests found for this patient." });
    }
    res.json(result.rows);
  } catch (error) {
    console.error("Error Fetching Patient Tests:", error);
    res.status(500).json({ error: error.message });
  }
};
