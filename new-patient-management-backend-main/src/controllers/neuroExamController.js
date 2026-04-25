import { pool } from "../models/db.js";
  // Modified createExam controller
  export const createExam = async (req, res) => {
    try {
      const { patient_id, consultation_id } = req.body;
  
      if (!patient_id || !consultation_id) {
        return res.status(400).json({ success: false, message: "Invalid patient and consultation ID" });
      }
  
      // Only check for patient_id and consultation_id as required
      const requiredFields = ["patient_id", "consultation_id"];
      const missingFields = requiredFields.filter(field => !req.body[field]);
  
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`
        });
      }
  
      // Prepare sanitized body
      const body = Object.entries(req.body).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' && value.trim() === '' ? null : value;
        return acc;
      }, {});
  
      // Add the boolean conversion logic here
      const booleanFields = [
        "temperature_sensation",
        "pain_sensation",
        "brudzinski_sign",
        "kernig_sign",
        "vibration_sense",
        "proprioception",
        "facial_sensation",
        "swallowing_function"
      ];
  
      // Convert string values to boolean
      booleanFields.forEach(field => {
        if (body[field] === "Intact" || body[field] === "Yes") body[field] = true;
        if (body[field] === "Reduced" || body[field] === "No") body[field] = false;
      });
  
      const query = `
        INSERT INTO neurological_exams (
          patient_id, consultation_id, motor_function, muscle_tone, muscle_strength,
          deep_tendon_reflexes, plantar_reflex, sensory_examination,
          pain_sensation, vibration_sense, proprioception, temperature_sensation,
          coordination, finger_nose_test, heel_shin_test, gait_assessment,
          romberg_test, cranial_nerves, pupillary_reaction, eye_movements,
          facial_sensation, swallowing_function, tongue_movement,
          straight_leg_raise_test, lasegue_test, brudzinski_sign,
          kernig_sign, cognitive_assessment, speech_assessment, straight_leg_raise_left, straight_leg_raise_right, 
          tremors, involuntary_movements, diagnosis, treatment_plan, notes, fundoscopy, mmse_score, gcs_score, power
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, $40)
        RETURNING *`;
  
      const values = [
        body.patient_id,
        body.consultation_id,
        body.motor_function,
        body.muscle_tone,
        body.muscle_strength,
        body.deep_tendon_reflexes,
        body.plantar_reflex,
        body.sensory_examination,
        body.pain_sensation,
        body.vibration_sense,
        body.proprioception,
        body.temperature_sensation,
        body.coordination,
        body.finger_nose_test,
        body.heel_shin_test,
        body.gait_assessment,
        body.romberg_test,
        body.cranial_nerves,
        body.pupillary_reaction,
        body.eye_movements,
        body.facial_sensation,
        body.swallowing_function,
        body.tongue_movement,
        body.straight_leg_raise_test,
        body.lasegue_test,
        body.brudzinski_sign,
        body.kernig_sign,
        body.cognitive_assessment,
        body.speech_assessment,
        body.straight_leg_raise_left,
        body.straight_leg_raise_right,
        body.tremors,
        body.involuntary_movements,
        body.diagnosis,
        body.treatment_plan,
        body.notes,
        body.fundoscopy,
        body.mmse_score,
        body.gcs_score,
        body.power
      ];
  
      const { rows } = await pool.query(query, values);
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error("Error creating neurological exam:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
  
  

export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows, rowCount } = await pool.query(
      "SELECT * FROM neurological_exams WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching neurological exam:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!Object.keys(updates).length) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    // Sanitize and validate ENUM fields
    Object.entries(updates).forEach(([field, value]) => {
      if (Object.keys(ENUM_VALIDATORS).includes(field)) {
        updates[field] = sanitizeEmptyStrings(value);
        validateEnumField(field, updates[field]);
      }
    });

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(", ");

    const query = `
        UPDATE neurological_examinations
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

    const values = [id, ...Object.values(updates)];
    const { rows, rowCount } = await pool.query(query, values);

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error updating neurological exam:", error);
    const statusCode = error.message.startsWith("Invalid value") ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
      ...(statusCode === 400 && {
        validValues: ENUM_VALIDATORS[error.message.split(" ")[2]],
      }),
    });
  }
};

export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      "DELETE FROM neurological_exams WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Exam deleted successfully" });
  } catch (error) {
    console.error("Error deleting neurological exam:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const listExamsByConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM neurological_exams WHERE consultation_id = $1 ORDER BY created_at DESC",
      [consultationId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error listing neurological exams:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const getExamsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const { rows } = await pool.query(
      "SELECT * FROM neurological_exams WHERE patient_id = $1",
      [patientId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No exams found for this patient" });
    }

    res.status(200).json({ success: true, data: rows });

  } catch (error) {
    console.error("Error fetching exams for patient:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
