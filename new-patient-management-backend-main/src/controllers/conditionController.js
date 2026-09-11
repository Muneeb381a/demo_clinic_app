import {pool} from "../models/db.js"
import { patientOwned, isPlatformAdmin } from "../middleware/scope.js";

// medical_conditions rows are owned through their patient.
const conditionOwned = async (id, user) => {
  const sql = isPlatformAdmin(user)
    ? "SELECT 1 FROM medical_conditions WHERE id = $1"
    : `SELECT 1 FROM medical_conditions mc JOIN patients p ON p.id = mc.patient_id
        WHERE mc.id = $1 AND p.clinic_id = $2`;
  const { rowCount } = await pool.query(sql, isPlatformAdmin(user) ? [id] : [id, user.clinic_id]);
  return rowCount > 0;
};

export const createCondition = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { condition_name, duration, diagnosis_date, notes } = req.body;

        if (!(await patientOwned(patient_id, req.user))) {
            return res.status(404).json({ error: "Patient not found" });
        }

        const result = await pool.query(
            `INSERT INTO medical_conditions 
             (patient_id, condition_name, duration, diagnosis_date, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [patient_id, condition_name, duration, diagnosis_date, notes]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getPatientConditions = async (req, res) => {
    try {
        const { patient_id } = req.params;
        if (!(await patientOwned(patient_id, req.user))) {
            return res.status(404).json({ error: "Patient not found" });
        }
        const result = await pool.query(
            `SELECT * FROM medical_conditions WHERE patient_id = $1`,
            [patient_id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateCondition = async (req, res) => {
    try {
        const { id } = req.params;
        const { condition_name, duration, diagnosis_date, notes } = req.body;

        if (!(await conditionOwned(id, req.user))) {
            return res.status(404).json({ error: "Condition not found" });
        }

        const result = await pool.query(
            `UPDATE medical_conditions SET
             condition_name = $1, duration = $2, 
             diagnosis_date = $3, notes = $4
             WHERE id = $5 RETURNING *`,
            [condition_name, duration, diagnosis_date, notes, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteCondition = async (req, res) => {
    try {
        const { id } = req.params;
        if (!(await conditionOwned(id, req.user))) {
            return res.status(404).json({ error: "Condition not found" });
        }
        await pool.query('DELETE FROM medical_conditions WHERE id = $1', [id]);
        res.json({ message: 'Condition deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};