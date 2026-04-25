import { pool } from "../models/db.js";

// export const createConsultation = async (req, res) => {
//   try {
//     const { patient_id, doctor_name, diagnosis, notes } = req.body;
//     const result = await pool.query(
//       `INSERT INTO consultations 
//              (patient_id, doctor_name, diagnosis, notes)
//              VALUES ($1, $2, $3, $4) RETURNING *`,
//       [patient_id, doctor_name, diagnosis, notes]
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

const sanitizeString = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/['";]/g, "");
};

const safeParseInt = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

export const createConsultation = async (req, res) => {
  const { patient_id, doctor_name, visit_date } = req.body;

  // Check for required fields
  if (!patient_id || !doctor_name) {
    return res.status(400).json({
      error: "Bad Request",
      details: "patient_id and doctor_name are required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Sanitize and prepare input
    const sanitizedDoctorName = sanitizeString(doctor_name);
    const parsedPatientId = safeParseInt(patient_id);
    const sanitizedVisitDate = visit_date ? sanitizeString(visit_date) : new Date().toISOString();

    if (parsedPatientId === null) {
      throw new Error("Invalid patient_id: must be a valid integer");
    }

    // Insert consultation (diagnosis/notes live in neurological_exams, not here)
    const result = await client.query(
      `INSERT INTO consultations
       (patient_id, doctor_name, visit_date)
       VALUES ($1, $2, $3) RETURNING *`,
      [parsedPatientId, sanitizedDoctorName, sanitizedVisitDate]
    );

    await client.query("COMMIT");
    res.status(201).json({
      message: "Consultation created successfully",
      consultation: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating consultation:", error);
    const statusCode = error.message.includes("Invalid patient_id") ? 400 : 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? "Bad Request" : "Internal Server Error",
      details: error.message,
    });
  } finally {
    client.release();
  }
};
export const getAllConsultations = async (req, res) => {
  try {
    // Single query with aggregated symptoms and vitals — no N+1
    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(
          JSON_AGG(DISTINCT s.*) FILTER (WHERE s.id IS NOT NULL), '[]'
        ) AS symptoms,
        COALESCE(
          JSON_AGG(DISTINCT vs.*) FILTER (WHERE vs.id IS NOT NULL), '[]'
        ) AS vitals
      FROM consultations c
      LEFT JOIN consultation_symptoms cs ON c.id = cs.consultation_id
      LEFT JOIN symptoms s ON cs.symptom_id = s.id
      LEFT JOIN vital_signs vs ON c.id = vs.consultation_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addConsultationSymptoms = async (req, res) => {
  try {
    const { patient_id, doctor_name } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    const result = await pool.query(
      "INSERT INTO consultations (patient_id, doctor_name) VALUES ($1, $2) RETURNING *",
      [patient_id, doctor_name || "Dr. Unknown"] // Provide a default value if missing
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding consultation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// In your consultation controller
export const getConsultationsByPatient = async (req, res) => {
  const { patientId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM consultations WHERE patient_id = $1",
      [patientId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching consultations" });
  }
};

export const getConsultationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Single query fetching consultation, symptoms, and vitals together
    const result = await pool.query(
      `SELECT
        c.*,
        COALESCE(
          JSON_AGG(DISTINCT s.*) FILTER (WHERE s.id IS NOT NULL), '[]'
        ) AS symptoms,
        COALESCE(
          JSON_AGG(DISTINCT vs.*) FILTER (WHERE vs.id IS NOT NULL), '[]'
        ) AS vitals
      FROM consultations c
      LEFT JOIN consultation_symptoms cs ON c.id = cs.consultation_id
      LEFT JOIN symptoms s ON cs.symptom_id = s.id
      LEFT JOIN vital_signs vs ON c.id = vs.consultation_id
      WHERE c.id = $1
      GROUP BY c.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createSymptom = async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      `INSERT INTO symptoms (name, is_custom) 
             VALUES ($1, $2) RETURNING *`,
      [name, req.body.is_custom === true ? true : false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getSymptoms = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM symptoms ORDER BY name ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addSymptomsToConsultation = async (req, res) => {
  const client = await pool.connect(); // Get client from pool
  try {
    const { consultationId } = req.params;
    const { symptom_ids } = req.body;

    if (!symptom_ids?.length) {
      return res.status(400).json({ error: "symptom_ids array is required" });
    }

    // Validate consultation exists
    const consultationCheck = await client.query(
      "SELECT id FROM consultations WHERE id = $1",
      [consultationId]
    );

    if (consultationCheck.rowCount === 0) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    // Validate symptoms exist
    const symptomsCheck = await client.query(
      "SELECT id FROM symptoms WHERE id = ANY($1::int[])",
      [symptom_ids]
    );

    if (symptomsCheck.rowCount !== symptom_ids.length) {
      const validIds = symptomsCheck.rows.map((r) => r.id);
      const invalidIds = symptom_ids.filter((id) => !validIds.includes(id));
      return res.status(400).json({
        error: "Invalid symptom IDs",
        invalid_ids: invalidIds,
      });
    }

    // Build insert query
    const placeholders = symptom_ids.map((_, i) => `($1, $${i + 2})`).join(",");

    const query = {
      text: `INSERT INTO consultation_symptoms 
             (consultation_id, symptom_id)
             VALUES ${placeholders}
             ON CONFLICT DO NOTHING`,
      values: [consultationId, ...symptom_ids],
    };

    await client.query("BEGIN");
    const result = await client.query(query);
    await client.query("COMMIT");

    res.json({
      success: true,
      added_count: result.rowCount,
      consultation_id: consultationId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database error:", error);
    res.status(500).json({
      error: "Internal server error",
      detail: error.message,
    });
  } finally {
    client.release(); // Release client back to pool
  }
};

export const removeSymptomFromConsultation = async (req, res) => {
  try {
    const { consultation_id, symptom_id } = req.params;
    await pool.query(
      `DELETE FROM consultation_symptoms 
             WHERE consultation_id = $1 AND symptom_id = $2`,
      [consultation_id, symptom_id]
    );
    res.json({ message: "Symptom removed from consultation" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/consultations/complete
// Saves an entire consultation in ONE database transaction:
//   consultation → vitals → symptoms → prescriptions → tests → neuro exam → follow-up
// Replaces 7 separate API calls with a single round-trip.
// ─────────────────────────────────────────────────────────────────────────────
export const saveCompleteConsultation = async (req, res) => {
  const {
    patient_id, doctor_name = "Dr. Abdul Rauf", visit_date,
    vitals, symptom_ids, medicines, test_ids, neuro, follow_up,
  } = req.body;

  const parsedPatientId = parseInt(patient_id);
  if (!parsedPatientId || isNaN(parsedPatientId)) {
    return res.status(400).json({ error: "patient_id is required and must be a number" });
  }

  // Validate medicines and tests BEFORE opening the transaction so we don't
  // hold a DB connection while doing existence checks. Run both in parallel.
  let validatedTestRows = [];
  const preChecks = [];

  if (Array.isArray(medicines) && medicines.length > 0) {
    const medIds = medicines.map((m) => parseInt(m.medicine_id)).filter((n) => !isNaN(n) && n > 0);
    if (medIds.length !== medicines.length) {
      return res.status(400).json({ error: "Bad Request", details: "One or more medicine_ids are invalid (must be positive integers)" });
    }
    const uniqueMedIds = [...new Set(medIds)];
    preChecks.push(
      pool.query("SELECT id FROM medicines WHERE id = ANY($1::int[])", [uniqueMedIds]).then((r) => {
        if (r.rowCount !== uniqueMedIds.length) {
          const validSet = new Set(r.rows.map((row) => row.id));
          throw Object.assign(new Error(`Medicine IDs do not exist: ${uniqueMedIds.filter((id) => !validSet.has(id)).join(", ")}`), { status: 400 });
        }
      })
    );
  }

  const parsedTestIds = Array.isArray(test_ids) ? test_ids.map(Number).filter((n) => !isNaN(n)) : [];
  if (parsedTestIds.length > 0) {
    preChecks.push(
      pool.query("SELECT id, test_name FROM tests WHERE id = ANY($1::int[])", [parsedTestIds]).then((r) => {
        if (r.rowCount !== parsedTestIds.length) {
          const validSet = new Set(r.rows.map((row) => row.id));
          throw Object.assign(new Error(`Test IDs do not exist: ${parsedTestIds.filter((id) => !validSet.has(id)).join(", ")}`), { status: 400 });
        }
        validatedTestRows = r.rows;
      })
    );
  }

  try {
    await Promise.all(preChecks);
  } catch (err) {
    return res.status(err.status || 400).json({ error: "Bad Request", details: err.message });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Consultation
    const consultRes = await client.query(
      `INSERT INTO consultations (patient_id, doctor_name, visit_date)
       VALUES ($1, $2, $3) RETURNING *`,
      [parsedPatientId, doctor_name, visit_date || new Date().toISOString()]
    );
    const consultation = consultRes.rows[0];
    const cId = consultation.id;

    // 2. Vitals (optional)
    let savedVitals = null;
    if (vitals && Object.values(vitals).some((v) => v !== null && v !== undefined && v !== "")) {
      const vRes = await client.query(
        `INSERT INTO vital_signs
           (consultation_id, patient_id, pulse_rate, blood_pressure, temperature, spo2_level, nihss_score, fall_assessment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [cId, parsedPatientId, vitals.pulse_rate ?? null, vitals.blood_pressure ?? null,
         vitals.temperature ?? null, vitals.spo2_level ?? null, vitals.nihss_score ?? null, vitals.fall_assessment ?? null]
      );
      savedVitals = vRes.rows[0];
    }

    // 3. Symptoms (optional)
    let addedSymptoms = 0;
    if (Array.isArray(symptom_ids) && symptom_ids.length > 0) {
      const ids = symptom_ids.map(Number).filter((n) => !isNaN(n));
      if (ids.length > 0) {
        const ph = ids.map((_, i) => `($1, $${i + 2})`).join(", ");
        const sRes = await client.query(
          `INSERT INTO consultation_symptoms (consultation_id, symptom_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
          [cId, ...ids]
        );
        addedSymptoms = sRes.rowCount;
      }
    }

    // 4. Prescriptions (optional) — IDs already validated before the transaction
    let savedPrescriptions = [];
    if (Array.isArray(medicines) && medicines.length > 0) {
      const medIds = medicines.map((m) => parseInt(m.medicine_id)).filter((n) => !isNaN(n) && n > 0);
      const vp = medicines.map((_, i) => {
        const b = i * 13;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},NOW())`;
      }).join(", ");
      const vals = medicines.flatMap((med, i) => [
        cId, parsedPatientId, medIds[i],
        med.dosage_en, med.dosage_urdu, med.frequency_en, med.frequency_urdu,
        med.duration_en, med.duration_urdu, med.instructions_en, med.instructions_urdu,
        med.how_to_take_en ?? null, med.how_to_take_urdu ?? null,
      ]);
      const pRes = await client.query(
        `INSERT INTO prescriptions
           (consultation_id, patient_id, medicine_id, dosage_en, dosage_urdu,
            frequency_en, frequency_urdu, duration_en, duration_urdu,
            instructions_en, instructions_urdu, how_to_take_en, how_to_take_urdu, prescribed_at)
         VALUES ${vp} RETURNING *`,
        vals
      );
      savedPrescriptions = pRes.rows;
    }

    // 5. Tests (optional) — IDs already validated before the transaction
    let assignedTests = [];
    if (Array.isArray(test_ids) && test_ids.length > 0) {
      const ids = test_ids.map(Number).filter((n) => !isNaN(n));
      if (ids.length > 0) {
        const tph = ids.map((_, i) => `($1, $${i + 2}, NOW())`).join(", ");
        await client.query(
          `INSERT INTO consultation_tests (consultation_id, test_id, assigned_at) VALUES ${tph} ON CONFLICT DO NOTHING`,
          [cId, ...ids]
        );
        assignedTests = validatedTestRows;
      }
    }

    // 6. Neurological Exam (optional)
    let savedNeuro = null;
    if (neuro && Object.keys(neuro).length > 0) {
      const n = Object.fromEntries(
        Object.entries(neuro).map(([k, v]) => [k, (typeof v === "string" && v.trim() === "") ? null : v])
      );
      const neuroRes = await client.query(
        `INSERT INTO neurological_exams (
           patient_id, consultation_id, motor_function, muscle_tone, muscle_strength,
           deep_tendon_reflexes, plantar_reflex, sensory_examination,
           pain_sensation, vibration_sense, proprioception, temperature_sensation,
           coordination, finger_nose_test, heel_shin_test, gait_assessment,
           romberg_test, cranial_nerves, pupillary_reaction, eye_movements,
           facial_sensation, swallowing_function, tongue_movement,
           straight_leg_raise_test, lasegue_test, brudzinski_sign,
           kernig_sign, cognitive_assessment, speech_assessment,
           straight_leg_raise_left, straight_leg_raise_right,
           tremors, involuntary_movements, diagnosis, treatment_plan, notes,
           fundoscopy, mmse_score, gcs_score, power
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                   $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40)
         RETURNING *`,
        [
          parsedPatientId, cId,
          n.motor_function, n.muscle_tone, n.muscle_strength,
          n.deep_tendon_reflexes, n.plantar_reflex, n.sensory_examination,
          n.pain_sensation ?? false, n.vibration_sense ?? false,
          n.proprioception ?? false, n.temperature_sensation ?? false,
          n.coordination, n.finger_nose_test, n.heel_shin_test, n.gait_assessment,
          n.romberg_test, n.cranial_nerves, n.pupillary_reaction, n.eye_movements,
          n.facial_sensation ?? false, n.swallowing_function ?? false, n.tongue_movement,
          n.straight_leg_raise_test, n.lasegue_test, n.brudzinski_sign ?? false,
          n.kernig_sign ?? false, n.cognitive_assessment, n.speech_assessment,
          n.straight_leg_raise_left, n.straight_leg_raise_right,
          n.tremors, n.involuntary_movements, n.diagnosis, n.treatment_plan, n.notes,
          n.fundoscopy, n.mmse_score ? parseInt(n.mmse_score) : null,
          n.gcs_score ? parseInt(n.gcs_score) : null, n.power,
        ]
      );
      savedNeuro = neuroRes.rows[0];
    }

    // 7. Follow-Up (optional)
    let savedFollowUp = null;
    if (follow_up?.follow_up_date) {
      const fuRes = await client.query(
        `INSERT INTO follow_ups (consultation_id, follow_up_date, notes) VALUES ($1, $2, $3) RETURNING *`,
        [cId, follow_up.follow_up_date, follow_up.notes || "عام چیک اپ"]
      );
      savedFollowUp = fuRes.rows[0];
    }

    await client.query("COMMIT");
    res.status(201).json({
      message: "Consultation saved successfully",
      consultation,
      vitals: savedVitals,
      symptoms_added: addedSymptoms,
      prescriptions: savedPrescriptions,
      tests: assignedTests,
      neuro: savedNeuro,
      follow_up: savedFollowUp,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("saveCompleteConsultation error:", error.message);
    const is400 = /Medicine IDs|Test IDs|One or more medicine/.test(error.message);
    res.status(is400 ? 400 : 500).json({
      error: is400 ? "Bad Request" : "Failed to save consultation",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

export const createFullConsultation = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    // 1. Create consultation
    const consultationRes = await dbClient.query(
      `INSERT INTO consultations (patient_id, doctor_name)
         VALUES ($1, $2) RETURNING id`,
      [req.body.patient_id, req.body.doctor_name]
    );
    const consultationId = consultationRes.rows[0].id;

    // 2. Process all related entities in transaction
    const followUpPromise =
      req.body.follow_up_date &&
      dbClient.query(
        `INSERT INTO follow_ups 
         (consultation_id, follow_up_date, notes)
         VALUES ($1, $2, $3)`,
        [
          consultationId,
          req.body.follow_up_date,
          req.body.notes || "عام چیک اپ",
        ]
      );

    const symptomsPromise =
      req.body.symptoms?.length &&
      dbClient.query(
        `INSERT INTO consultation_symptoms (consultation_id, symptom_id)
         SELECT $1, unnest($2::int[])`,
        [consultationId, req.body.symptoms]
      );

    // Add other entity promises (vitals, prescriptions, etc.)

    await Promise.all([followUpPromise, symptomsPromise]);
    await dbClient.query("COMMIT");

    res.status(201).json({ id: consultationId });
  } catch (error) {
    await dbClient.query("ROLLBACK");
    console.error("Transaction Error:", error);
    res.status(500).json({
      error: "Failed to create consultation",
      details: process.env.NODE_ENV === "development" ? error.message : null,
    });
  } finally {
    dbClient.release();
  }
};
