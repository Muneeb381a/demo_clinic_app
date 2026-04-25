import {pool} from "../models/db.js"

export const createCondition = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { condition_name, duration, diagnosis_date, notes } = req.body;
        
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
        await pool.query('DELETE FROM medical_conditions WHERE id = $1', [id]);
        res.json({ message: 'Condition deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};