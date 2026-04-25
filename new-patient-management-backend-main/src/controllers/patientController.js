import { pool } from "../models/db.js";
import { cacheGet, cacheSet, cacheGetSWR, cacheDel, cacheDelPattern } from "../utils/cache.js";
import { v4 as uuidv4 } from "uuid";

// TTL constants
const PATIENT_LIST_HARD_TTL = 3600;  // keep stale data up to 1 hour
const PATIENT_LIST_SOFT_TTL = 300;   // refresh in background every 5 min
const PATIENT_SINGLE_TTL    = 600;   // single patient: 10 min
const PATIENT_SEARCH_TTL    = 300;   // search/suggest: 5 min

// ---------------------------------------------------------------------------
// Create Patient
// ---------------------------------------------------------------------------
export const createPatient = async (req, res) => {
  try {
    const { mobile, name, age, gender, weight, height } = req.body;
    const mr_no = `MR-${uuidv4()}`;

    const result = await pool.query(
      `INSERT INTO patients (mobile, mr_no, name, age, gender, weight, height, checkup_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE) RETURNING *`,
      [mobile, mr_no, name, age, gender, weight, height]
    );

    await Promise.all([
      cacheDelPattern("patients:list:*"),
      cacheDelPattern("patients:search:*"),
      cacheDelPattern("patients:suggest:*"),
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "MR number collision detected. Try again." });
    }
    res.status(500).json({ error: "Failed to create patient", details: error.message });
  }
};

// ---------------------------------------------------------------------------
// Get All Patients — SWR: always instant from cache, refreshes in background
// ---------------------------------------------------------------------------
export const getPatients = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || "500", 10), 1000);
    const offset = Math.max(parseInt(req.query.offset || "0",   10), 0);
    const cacheKey = `patients:list:${limit}:${offset}`;

    const data = await cacheGetSWR(
      cacheKey,
      async () => {
        const result = await pool.query(
          `SELECT id, name, age, gender, mobile, weight, height, mr_no,
                  TO_CHAR(checkup_date, 'DD-Mon-YYYY') AS checkup_date
           FROM patients
           ORDER BY id DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        return result.rows;
      },
      PATIENT_LIST_HARD_TTL,
      PATIENT_LIST_SOFT_TTL
    );

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------------------------------------------------------------------------
// Get Single Patient
// ---------------------------------------------------------------------------
export const getPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `patients:single:${id}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const result = await pool.query("SELECT * FROM patients WHERE id = $1", [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: "Patient not found" });
    }

    await cacheSet(cacheKey, result.rows[0], PATIENT_SINGLE_TTL);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------------------------------------------------------------------------
// Update Patient
// ---------------------------------------------------------------------------
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { mobile, name, age, gender, weight, height } = req.body;
    const result = await pool.query(
      `UPDATE patients SET
       mobile = $1, name = $2, age = $3, gender = $4, weight = $5, height = $6
       WHERE id = $7 RETURNING *`,
      [mobile, name, age, gender, weight, height, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Patient not found" });
    }
    await Promise.all([
      cacheDelPattern("patients:list:*"),
      cacheDelPattern("patients:search:*"),
      cacheDelPattern("patients:suggest:*"),
      cacheDel(`patients:single:${id}`),
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ---------------------------------------------------------------------------
// Delete Patient
// ---------------------------------------------------------------------------
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM patients WHERE id = $1 RETURNING id",
      [id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Patient not found" });
    }
    await Promise.all([
      cacheDelPattern("patients:list:*"),
      cacheDelPattern("patients:search:*"),
      cacheDelPattern("patients:suggest:*"),
      cacheDel(`patients:single:${id}`),
    ]);
    res.json({ message: "Patient deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------------------------------------------------------------------------
// Search Patient — cached per search term
// ---------------------------------------------------------------------------
export const searchPatient = async (req, res) => {
  try {
    const { mobile, name } = req.query;
    const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    if (!mobile && !name) {
      return res.status(400).json({ success: false, message: "At least one of mobile number or name is required" });
    }
    if (mobile && !/^\d{7,15}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid mobile number format" });
    }
    if (name && !/^[\p{L}\s]{1,50}$/u.test(name)) {
      return res.status(400).json({ success: false, message: "Invalid name format" });
    }

    const cacheKey = `patients:search:${mobile || ""}:${name || ""}:p${page}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const params = [];
    let conditions = [];

    if (mobile) {
      if (/^\d{10,11}$/.test(mobile)) {
        params.push(mobile);
        conditions.push(`mobile = $${params.length}`);
      } else {
        params.push(`${mobile}%`);
        conditions.push(`mobile LIKE $${params.length}`);
      }
    }

    let orderBy = "id ASC";
    if (name) {
      params.push(`%${name}%`);
      conditions.push(`name ILIKE $${params.length}`);
      // Use trigram similarity for relevance ordering (GIN index makes ILIKE fast)
      params.push(name);
      orderBy = `similarity(name, $${params.length}) DESC, name ASC`;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query for pagination metadata
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM patients ${where}`,
      params.slice(0, name ? params.length - 1 : params.length)
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, mobile, name FROM patients ${where} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    let response;
    if (!dataResult.rows.length) {
      response = { success: true, exists: false, message: "No patients found", pagination: { total: 0, page, limit, pages: 0 } };
    } else {
      const patients = dataResult.rows.map((p) => ({ ...p, name: p.name?.trim() || "Unknown" }));
      response = {
        success: true,
        exists: true,
        data: patients.length === 1 && page === 1 ? patients[0] : patients,
        message: total > 1 ? `${total} patients found` : null,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      };
    }

    await cacheSet(cacheKey, response, PATIENT_SEARCH_TTL);
    res.json(response);
  } catch (error) {
    console.error("searchPatient error:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Suggest Patient (autocomplete) — cached per prefix
// ---------------------------------------------------------------------------
export const suggestPatient = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name query parameter is required" });
    }
    if (!/^[\p{L}\s]{1,50}$/u.test(name)) {
      return res.status(400).json({ success: false, message: "Invalid name format. Use letters and spaces only, up to 50 characters." });
    }

    const cacheKey = `patients:suggest:${name.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const result = await pool.query(
      `SELECT id, name, mobile, age, gender FROM patients WHERE name ILIKE $1 ORDER BY name ASC LIMIT 5`,
      [`${name}%`]
    );

    const suggestions = result.rows.map((row) => ({
      id: row.id,
      name: row.name?.trim() || "Unknown",
      mobile: row.mobile || "N/A",
      age: row.age || null,
      gender: row.gender || null,
    }));

    const response = { success: true, data: suggestions };
    await cacheSet(cacheKey, response, PATIENT_SEARCH_TTL);
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Get Patient Consultation History
// ---------------------------------------------------------------------------
export const getPatientHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*,
              ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL) AS symptoms,
              ARRAY_AGG(DISTINCT m.name) FILTER (WHERE m.name IS NOT NULL) AS medicines
       FROM consultations c
       LEFT JOIN consultation_symptoms cs ON c.id = cs.consultation_id
       LEFT JOIN symptoms s ON cs.symptom_id = s.id
       LEFT JOIN consultation_medicines cm ON c.id = cm.consultation_id
       LEFT JOIN medicines m ON cm.medicine_id = m.id
       WHERE c.patient_id = $1
       GROUP BY c.id
       ORDER BY c.id DESC`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No consultations found" });
    }

    res.json({ consultations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
