import { pool } from "../models/db.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.js";

const SYMPTOM_LIST_KEY = "symptoms:all";
const SYMPTOM_TTL = 600; // 10 minutes

// Create Symptom — invalidates list cache
export const createSymptom = async (req, res) => {
  try {
    const { name, is_custom } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Symptom name is required" });
    }
    const result = await pool.query(
      `INSERT INTO symptoms (name, is_custom) VALUES ($1, $2) RETURNING *`,
      [name, is_custom || false]
    );
    await cacheDel(SYMPTOM_LIST_KEY);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("createSymptom error:", error.message);
    res.status(500).json({ error: "Failed to create symptom" });
  }
};

// Get All Symptoms — served from Redis cache after first call
export const getSymptoms = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    const cached = await cacheGet(SYMPTOM_LIST_KEY);
    if (cached) return res.json(cached);

    const result = await pool.query("SELECT * FROM symptoms ORDER BY name ASC");
    await cacheSet(SYMPTOM_LIST_KEY, result.rows, SYMPTOM_TTL);
    res.json(result.rows);
  } catch (error) {
    console.error("getSymptoms error:", error.message);
    res.status(500).json({ error: "Failed to fetch symptoms" });
  }
};

// Add Symptom to Consultation (Unified function)
export const addSymptomToConsultation = async (req, res) => {
    try {
      const { consultation_id, symptoms } = req.body;
      
      if (!consultation_id || !symptoms?.length) {
        return res.status(400).json({
          error: "consultation_id and symptoms array are required"
        });
      }
  
      await pool.query("BEGIN");
  
      // Get patient_id from consultation
      const patientQuery = await pool.query(
        "SELECT patient_id FROM consultations WHERE id = $1",
        [consultation_id]
      );
      
      if (patientQuery.rowCount === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "Consultation not found" });
      }
  
      const patient_id = patientQuery.rows[0].patient_id;
  
      // Insert multiple symptoms
      const values = symptoms.map((s, index) => 
        `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
      ).join(',');
  
      await pool.query(
        `INSERT INTO consultation_symptoms 
         (consultation_id, symptom_id, patient_id)
         VALUES ${values}
         ON CONFLICT DO NOTHING`,
        symptoms.flatMap(s => [consultation_id, s.symptom_id, patient_id])
      );
  
      await pool.query("COMMIT");
      res.json({
        message: `${symptoms.length} symptoms added to consultation`,
        count: symptoms.length
      });
    } catch (error) {
      await pool.query("ROLLBACK");
      console.error("addSymptomToConsultation error:", error.message);
      res.status(500).json({
        error: "Failed to add symptoms to consultation",
        details: error.message
      });
    }
  };

// Remove Symptom from Consultation
export const removeSymptomFromConsultation = async (req, res) => {
  try {
    const { consultation_id, symptom_id } = req.params;
    if (!consultation_id || !symptom_id) {
      return res
        .status(400)
        .json({ error: "consultation_id and symptom_id are required" });
    }

    const result = await pool.query(
      `DELETE FROM consultation_symptoms 
       WHERE consultation_id = $1 AND symptom_id = $2`,
      [consultation_id, symptom_id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Symptom not found in consultation" });
    }

    res.json({ message: "Symptom removed from consultation" });
  } catch (error) {
    console.error("removeSymptomFromConsultation error:", error.message);
    res.status(500).json({ error: "Failed to remove symptom" });
  }
};

// Update a Symptom
export const updateSymptom = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_custom } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Symptom ID is required" });
    }

    const result = await pool.query(
      `UPDATE symptoms 
       SET name = COALESCE($1, name),
           is_custom = COALESCE($2, is_custom)
       WHERE id = $3
       RETURNING *`,
      [name, is_custom, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Symptom not found" });
    }

    await cacheDel(SYMPTOM_LIST_KEY);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("updateSymptom error:", error.message);
    res.status(500).json({ error: "Failed to update symptom" });
  }
};

// Update a Symptom for a Consultation
export const updateConsultationSymptom = async (req, res) => {
  try {
    const { consultation_id, old_symptom_id, new_symptom_id } = req.body;
    if (!consultation_id || !old_symptom_id || !new_symptom_id) {
      return res.status(400).json({
        error: "consultation_id, old_symptom_id, and new_symptom_id are required",
      });
    }

    const result = await pool.query(
      `UPDATE consultation_symptoms
       SET symptom_id = $1
       WHERE consultation_id = $2 AND symptom_id = $3
       RETURNING *`,
      [new_symptom_id, consultation_id, old_symptom_id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Consultation-Symptom record not found" });
    }

    res.json({ message: "Consultation symptom updated", data: result.rows[0] });
  } catch (error) {
    console.error("updateConsultationSymptom error:", error.message);
    res.status(500).json({ error: "Failed to update consultation symptom" });
  }
};

// Remove redundant function (addConsultationSymptom is identical to addSymptomToConsultation)