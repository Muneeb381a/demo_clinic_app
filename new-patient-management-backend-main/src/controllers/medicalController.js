import { pool } from "../models/db.js";

export const addMedicalEntry = async (req, res) => {
    const { patientId } = req.params;
    const {
        pulse_rate,
        blood_pressure,
        oxygen_saturation,
        hba1c,
        symptoms
    } = req.body;

    try {
        const patientResult = await pool.query(
            "SELECT weight, height FROM patients WHERE id = $1",
            [patientId]
        );

        if (patientResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Patient not found" });
        }

        const patient = patientResult.rows[0];
        const bmi = patient.weight && patient.height
            ? patient.weight / ((patient.height / 100) ** 2)
            : null;
        const bsa = patient.weight && patient.height
            ? Math.sqrt((patient.weight * patient.height) / 3600)
            : null;

        const result = await pool.query(
            `INSERT INTO medical_history
            (patient_id, pulse_rate, blood_pressure, oxygen_saturation, hba1c, symptoms)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [patientId, pulse_rate, blood_pressure, oxygen_saturation, hba1c, symptoms]
        );

        if (bmi !== null) {
            await pool.query(
                `UPDATE patients SET body_mass_index = $1, body_surface_area = $2 WHERE id = $3`,
                [bmi, bsa, patientId]
            );
        }

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};