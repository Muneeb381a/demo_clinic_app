import {pool } from "../models/db.js"
export const recordVitals = async (req, res) => {
    try {
        const {
            consultation_id,
            patient_id,
            pulse_rate,
            blood_pressure,
            temperature,
            spo2_level,
            nihss_score,
            fall_assessment
        } = req.body;

        if (!consultation_id || !patient_id) {
            return res.status(400).json({ message: "consultation_id and patient_id are required" });
        }

        // Let the DB foreign key constraint enforce patient/consultation existence;
        // avoids an extra round-trip query on every vitals submission
        const result = await pool.query(
            `INSERT INTO vital_signs (
                consultation_id,
                patient_id,
                pulse_rate,
                blood_pressure,
                temperature,
                spo2_level,
                nihss_score,
                fall_assessment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                consultation_id,
                patient_id,
                pulse_rate ?? null,
                blood_pressure ?? null,
                temperature ?? null,
                spo2_level ?? null,
                nihss_score ?? null,
                fall_assessment ?? null
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23503') {
            // FK violation — patient or consultation does not exist
            return res.status(404).json({ message: "Patient or consultation not found" });
        }
        console.error("Error recording vitals:", error);
        res.status(500).json({ message: "Internal Server Error", details: error.message });
    }
};


export const getVitalHistory = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const result = await pool.query(`
            SELECT vs.* FROM vital_signs vs
            JOIN consultations c ON vs.consultation_id = c.id
            WHERE c.patient_id = $1
            ORDER BY vs.recorded_at DESC
        `, [patient_id]);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};