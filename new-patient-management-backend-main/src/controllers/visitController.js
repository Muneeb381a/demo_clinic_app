import { pool } from "../models/db.js";

// Get all visits
// Get all visits with patient and doctor names
export const getVisits = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                visits.id,
                visits.patient_id,
                visits.doctor_id,
                visits.visit_date,
                visits.diagnosis,
                visits.diagnosis_urdu,
                patients.name AS patient_name,
                doctors.name AS doctor_name
            FROM visits
            JOIN patients ON visits.patient_id = patients.id
            JOIN doctors ON visits.doctor_id = doctors.id
            ORDER BY visits.visit_date DESC
        `);

    const formattedVisits = result.rows.map((visit) => ({
      id: visit.id,
      patient_id: visit.patient_id,
      patient_name: visit.patient_name,
      doctor_id: visit.doctor_id,
      doctor_name: visit.doctor_name,
      visit_date: visit.visit_date,
      diagnosis: visit.diagnosis,
      diagnosis_urdu: visit.diagnosis_urdu,
    }));

    return res.status(200).json({
      success: true,
      message: "Visits retrieved successfully",
      data: formattedVisits,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get a single visit by ID
// Get a single visit by ID with patient and doctor names
export const getVisitById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `
            SELECT 
                visits.id,
                visits.patient_id,
                visits.doctor_id,
                visits.visit_date,
                visits.diagnosis,
                visits.diagnosis_urdu,
                patients.name AS patient_name,
                doctors.name AS doctor_name
            FROM visits
            JOIN patients ON visits.patient_id = patients.id
            JOIN doctors ON visits.doctor_id = doctors.id
            WHERE visits.id = $1
        `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    const visit = result.rows[0];
    return res.status(200).json({
      success: true,
      message: "Visit retrieved successfully",
      data: visit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Add new visit
export const addVisit = async (req, res) => {
  const { patient_id, doctor_id, visit_date, diagnosis, diagnosis_urdu } =
    req.body;
  try {
    const result = await pool.query(
      `INSERT INTO visits (patient_id, doctor_id, visit_date, diagnosis, diagnosis_urdu) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patient_id, doctor_id, visit_date, diagnosis, diagnosis_urdu]
    );

    const visit = result.rows[0];
    return res.status(201).json({
      success: true,
      message: "Visit added successfully",
      data: visit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update visit
export const updateVisit = async (req, res) => {
  const { id } = req.params;
  const { patient_id, doctor_id, visit_date, diagnosis, diagnosis_urdu } =
    req.body;
  try {
    const result = await pool.query(
      `UPDATE visits SET patient_id=$1, doctor_id=$2, visit_date=$3, diagnosis=$4, diagnosis_urdu=$5 
             WHERE id=$6 RETURNING *`,
      [patient_id, doctor_id, visit_date, diagnosis, diagnosis_urdu, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    const visit = result.rows[0];
    return res.status(200).json({
      success: true,
      message: "Visit updated successfully",
      data: visit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete visit
export const deleteVisit = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM visits WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Visit deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
