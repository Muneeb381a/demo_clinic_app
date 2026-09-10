import { pool } from "../models/db.js";
import { ApiError } from "../utils/ApiError.js";
import { patientOwned, consultationOwned } from "../middleware/scope.js";

export const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    if (!(await patientOwned(patientId, req.user))) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const query = `
      WITH patient_data AS (
        SELECT
          p.id AS patient_id,
          p.name AS patient_name,
          p.mobile,
          p.age,
          p.gender,
          c.id AS consultation_id,
          c.visit_date,
          f.follow_up_date,
          ne.diagnosis AS neuro_diagnosis,
          ne.treatment_plan AS neuro_treatment_plan,
          ne.motor_function,
          ne.muscle_tone,
          ne.muscle_strength,
          ne.deep_tendon_reflexes,
          ne.plantar_reflex,
          ne.sensory_examination,
          ne.pain_sensation,
          ne.vibration_sense,
          ne.proprioception,
          ne.temperature_sensation,
          ne.coordination,
          ne.finger_nose_test,
          ne.heel_shin_test,
          ne.gait_assessment,
          ne.romberg_test,
          ne.cranial_nerves,
          ne.pupillary_reaction,
          ne.eye_movements,
          ne.facial_sensation,
          ne.swallowing_function,
          ne.tongue_movement,
          ne.straight_leg_raise_test,
          ne.lasegue_test,
          ne.brudzinski_sign,
          ne.kernig_sign,
          ne.cognitive_assessment,
          ne.speech_assessment,
          ne.tremors,
          ne.involuntary_movements,
          ne.notes,
          ne.fundoscopy,
          ne.mmse_score,
          ne.gcs_score,
          ne.straight_leg_raise_left,
          ne.straight_leg_raise_right,
          ne.power
        FROM patients p
        LEFT JOIN consultations c ON p.id = c.patient_id
        LEFT JOIN follow_ups f ON c.id = f.consultation_id
        LEFT JOIN neurological_exams ne ON c.id = ne.consultation_id
        WHERE p.id = $1
      ),
      symptom_data AS (
        SELECT
          c.id AS consultation_id,
          ARRAY_AGG(DISTINCT s.name) AS symptoms
        FROM consultations c
        LEFT JOIN consultation_symptoms cs ON c.id = cs.consultation_id
        LEFT JOIN symptoms s ON cs.symptom_id = s.id
        WHERE c.patient_id = $1
        GROUP BY c.id
      ),
      prescription_data AS (
        SELECT
          pr.consultation_id,
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'prescription_id', pr.id,
              'medicine_id', pr.medicine_id,
              'brand_name', m.brand_name,
              'dosage_en', pr.dosage_en,
              'dosage_urdu', pr.dosage_urdu,
              'frequency_en', pr.frequency_en,
              'frequency_urdu', pr.frequency_urdu,
              'duration_en', pr.duration_en,
              'duration_urdu', pr.duration_urdu,
              'instructions_en', pr.instructions_en,
              'instructions_urdu', pr.instructions_urdu,
              'how_to_take_en', pr.how_to_take_en,
              'how_to_take_urdu', pr.how_to_take_urdu,
              'prescribed_at', pr.prescribed_at
            )
          ) AS prescriptions
        FROM prescriptions pr
        LEFT JOIN medicines m ON pr.medicine_id = m.id
        LEFT JOIN consultations c ON pr.consultation_id = c.id
        WHERE c.patient_id = $1
        GROUP BY pr.consultation_id
      ),
      test_data AS (
        SELECT
          ct.consultation_id,
          JSON_AGG(
            JSONB_BUILD_OBJECT(
              'test_id', ct.test_id,
              'test_name', t.test_name,
              'test_notes', t.test_notes,
              'created_at', ct.assigned_at
            )
          ) AS tests
        FROM consultation_tests ct
        JOIN tests t ON ct.test_id = t.id
        JOIN consultations c ON ct.consultation_id = c.id
        WHERE c.patient_id = $1
        GROUP BY ct.consultation_id
      ),
      vital_signs_data AS (
        SELECT
          vs.consultation_id,
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'vital_id', vs.id,
              'pulse_rate', vs.pulse_rate,
              'blood_pressure', vs.blood_pressure,
              'temperature', vs.temperature,
              'spo2_level', vs.spo2_level,
              'nihss_score', vs.nihss_score,
              'fall_assessment', vs.fall_assessment,
              'recorded_at', vs.recorded_at
            )
          ) AS vital_signs
        FROM vital_signs vs
        LEFT JOIN consultations c ON vs.consultation_id = c.id
        WHERE c.patient_id = $1
        GROUP BY vs.consultation_id
      )
      SELECT
        pd.*,
        COALESCE(sd.symptoms, '{}') AS symptoms,
        COALESCE(prd.prescriptions, '[]') AS prescriptions,
        COALESCE(td.tests, '[]') AS tests,
        COALESCE(vsd.vital_signs, '[]') AS vital_signs
      FROM patient_data pd
      LEFT JOIN symptom_data sd ON pd.consultation_id = sd.consultation_id
      LEFT JOIN prescription_data prd ON pd.consultation_id = prd.consultation_id
      LEFT JOIN test_data td ON pd.consultation_id = td.consultation_id
      LEFT JOIN vital_signs_data vsd ON pd.consultation_id = vsd.consultation_id
      ORDER BY pd.visit_date DESC;
    `;

    const result = await pool.query(query, [patientId]);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching patient history:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

export const getSpecificConsultationForPatient = async (req, res) => {
  try {
    const { patientId, consultationId } = req.params;

    if (!patientId || !consultationId) {
      return res
        .status(400)
        .json({ error: "Patient ID and Consultation ID are required" });
    }

    if (!(await consultationOwned(consultationId, req.user))) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    const query = `
      WITH patient_data AS (
    SELECT 
        p.id AS patient_id, 
        p.name AS patient_name, 
        p.mobile, 
        p.age, 
        p.gender, 
        c.id AS consultation_id,
        c.visit_date,
        f.follow_up_date,
        ne.diagnosis AS neuro_diagnosis,
        ne.treatment_plan AS neuro_treatment_plan,
        ne.motor_function, 
        ne.muscle_tone, 
        ne.muscle_strength, 
        ne.deep_tendon_reflexes, 
        ne.plantar_reflex, 
        ne.sensory_examination, 
        ne.pain_sensation, 
        ne.vibration_sense, 
        ne.proprioception, 
        ne.temperature_sensation, 
        ne.coordination, 
        ne.finger_nose_test, 
        ne.heel_shin_test, 
        ne.gait_assessment, 
        ne.romberg_test, 
        ne.cranial_nerves, 
        ne.pupillary_reaction, 
        ne.eye_movements, 
        ne.facial_sensation, 
        ne.swallowing_function, 
        ne.tongue_movement, 
        ne.straight_leg_raise_test, 
        ne.lasegue_test, 
        ne.brudzinski_sign, 
        ne.kernig_sign, 
        ne.cognitive_assessment, 
        ne.speech_assessment, 
        ne.tremors, 
        ne.involuntary_movements, 
        ne.notes, 
        ne.fundoscopy,
        ne.mmse_score,
        ne.gcs_score,
        ne.straight_leg_raise_left,
        ne.straight_leg_raise_right,
        ne.power
    FROM patients p
    LEFT JOIN consultations c ON p.id = c.patient_id
    LEFT JOIN follow_ups f ON c.id = f.consultation_id
    LEFT JOIN neurological_exams ne ON c.id = ne.consultation_id
    WHERE p.id = $1 AND c.id = $2
),
symptom_data AS (
    SELECT 
        c.id AS consultation_id,
        ARRAY_AGG(DISTINCT s.name) AS symptoms
    FROM consultations c
    LEFT JOIN consultation_symptoms cs ON c.id = cs.consultation_id 
    LEFT JOIN symptoms s ON cs.symptom_id = s.id 
    WHERE c.patient_id = $1 AND c.id = $2
    GROUP BY c.id
),
prescription_data AS (
    SELECT 
        pr.consultation_id,
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'prescription_id', pr.id,
                'medicine_id', pr.medicine_id,
                'brand_name', m.brand_name,
                'dosage_en', pr.dosage_en,
                'dosage_urdu', pr.dosage_urdu,
                'frequency_en', pr.frequency_en,
                'frequency_urdu', pr.frequency_urdu,
                'duration_en', pr.duration_en,
                'duration_urdu', pr.duration_urdu,
                'instructions_en', pr.instructions_en,
                'instructions_urdu', pr.instructions_urdu,
                'how_to_take_en', pr.how_to_take_en,
                'how_to_take_urdu', pr.how_to_take_urdu,
                'prescribed_at', pr.prescribed_at
            )
        ) AS prescriptions
    FROM prescriptions pr
    LEFT JOIN medicines m ON pr.medicine_id = m.id
    LEFT JOIN consultations c ON pr.consultation_id = c.id
    WHERE c.patient_id = $1 AND c.id = $2
    GROUP BY pr.consultation_id
),
test_data AS (
        SELECT
          ct.consultation_id,
          JSON_AGG(
            JSONB_BUILD_OBJECT(
              'test_id', ct.test_id,
              'test_name', t.test_name,
              'test_notes', t.test_notes,
              'created_at', ct.assigned_at
            )
          ) AS tests
        FROM consultation_tests ct
        JOIN tests t ON ct.test_id = t.id
        JOIN consultations c ON ct.consultation_id = c.id
        WHERE c.patient_id = $1
        GROUP BY ct.consultation_id
      ),
vital_signs_data AS (
    SELECT 
        vs.consultation_id,
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'vital_id', vs.id,
                'pulse_rate', vs.pulse_rate,
                'blood_pressure', vs.blood_pressure,
                'temperature', vs.temperature,
                'spo2_level', vs.spo2_level,
                'nihss_score', vs.nihss_score,
                'fall_assessment', vs.fall_assessment,  
                'recorded_at', vs.recorded_at
            )
        ) AS vital_signs
    FROM vital_signs vs
    LEFT JOIN consultations c ON vs.consultation_id = c.id
    WHERE c.patient_id = $1 AND c.id = $2
    GROUP BY vs.consultation_id
),
followup_data AS (
  SELECT 
    consultation_id,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'follow_up_date', follow_up_date,
        'notes', notes,
        'created_at', created_at
      )
    ) AS follow_ups
  FROM follow_ups
  WHERE consultation_id = $2
  GROUP BY consultation_id
)
SELECT 
    pd.*,
    COALESCE(sd.symptoms, '{}') AS symptoms,
    COALESCE(prd.prescriptions, '[]') AS prescriptions,
    COALESCE(td.tests, '[]') AS tests,
    COALESCE(vsd.vital_signs, '[]') AS vital_signs,
    COALESCE(fd.follow_ups, '[]') AS follow_ups 
FROM patient_data pd
LEFT JOIN symptom_data sd ON pd.consultation_id = sd.consultation_id
LEFT JOIN prescription_data prd ON pd.consultation_id = prd.consultation_id
LEFT JOIN test_data td ON pd.consultation_id = td.consultation_id
LEFT JOIN vital_signs_data vsd ON pd.consultation_id = vsd.consultation_id
LEFT JOIN followup_data fd ON pd.consultation_id = fd.consultation_id
ORDER BY pd.visit_date DESC;

    `;


    const result = await pool.query(query, [patientId, consultationId]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Consultation not found for this patient" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching patient consultation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// const sanitizeString = (input) => {
//   if (typeof input !== "string") return input;
//   return input.replace(/['";]/g, "");
// };
// const safeParseInt = (value) => {
//   const parsed = parseInt(value, 10);
//   return isNaN(parsed) ? null : parsed;
// };

// export const updateConsultationForPatient = async (req, res) => {
//   const { consultationId } = req.params;
//   const data = req.body;
//   let client;

//   if (!consultationId) {
//     return res.status(400).json({ error: "Consultation ID is required" });
//   }

//   try {
//     client = await pool.connect();
//     await client.query("BEGIN");

//     // Log received data for debugging
//     console.log("Received data:", data);


//     // 1. Verify consultation exists and get patient_id
//     const consultationCheck = await client.query(
//       `SELECT patient_id FROM consultations WHERE id = $1`,
//       [consultationId]
//     );
    
//     if (consultationCheck.rowCount === 0) {
//       throw new Error(`Consultation ID ${consultationId} not found`);
//     }
    
//     const patientId = consultationCheck.rows[0].patient_id;

//     // 2. Update allowed patient fields (name, age, gender) but block mobile
//     if (data.patient_name || data.gender || data.age !== undefined) {
//       const patientFields = [];
//       const patientValues = [];
//       let paramIndex = 1;

//       if (data.patient_name) {
//         patientFields.push(`name = $${paramIndex++}`);
//         patientValues.push(sanitizeString(data.patient_name));
//       }
      
//       if (data.gender) {
//         patientFields.push(`gender = $${paramIndex++}`);
//         patientValues.push(sanitizeString(data.gender));
//       }
      
//       if (data.age !== undefined) {
//         patientFields.push(`age = $${paramIndex++}`);
//         patientValues.push(safeParseInt(data.age));
//       }

//       // Explicitly check if mobile was included in request
//       if (data.mobile !== undefined) {
//         patientFields.push(`mobile = $${paramIndex++}`);
//         patientValues.push(safeParseInt(data.mobile));
//       }

//       if (patientFields.length > 0) {
//         patientValues.push(patientId);
//         await client.query(
//           `UPDATE patients SET ${patientFields.join(", ")} WHERE id = $${paramIndex}`,
//           patientValues
//         );
//       }
//     }


//     // 1. Update consultations table (visit_date)
//     if (data.visit_date) {
//       await client.query(
//         `UPDATE consultations SET visit_date = $1 WHERE id = $2`,
//         [data.visit_date, consultationId]
//       );
//     }

//     // 2. Update or Insert neurological_exams table
//     const neuroFields = [
//       "diagnosis",
//       "treatment_plan",
//       "motor_function",
//       "muscle_tone",
//       "muscle_strength",
//       "deep_tendon_reflexes",
//       "plantar_reflex",
//       "sensory_examination",
//       "pain_sensation",
//       "vibration_sense",
//       "proprioception",
//       "temperature_sensation",
//       "coordination",
//       "finger_nose_test",
//       "heel_shin_test",
//       "gait_assessment",
//       "romberg_test",
//       "cranial_nerves",
//       "pupillary_reaction",
//       "eye_movements",
//       "facial_sensation",
//       "swallowing_function",
//       "tongue_movement",
//       "straight_leg_raise_test",
//       "lasegue_test",
//       "brudzinski_sign",
//       "kernig_sign",
//       "cognitive_assessment",
//       "speech_assessment",
//       "tremors",
//       "involuntary_movements",
//       "notes",
//       "fundoscopy",
//       "mmse_score",
//       "gcs_score",
//       "straight_leg_raise_left",
//       "straight_leg_raise_right",
//     ];

//     const neuroUpdateFields = neuroFields.filter(
//       (field) => data[field] !== undefined
//     );
//     if (neuroUpdateFields.length > 0) {
//       // Check if a row exists in neurological_exams
//       const checkResult = await client.query(
//         `SELECT 1 FROM neurological_exams WHERE consultation_id = $1`,
//         [consultationId]
//       );

//       if (checkResult.rowCount > 0) {
//         // Update existing row
//         const setClause = neuroUpdateFields
//           .map((field, i) => `${field} = $${i + 1}`)
//           .join(", ");
//         const values = neuroUpdateFields.map((field) => data[field]);
//         values.push(consultationId);
//         console.log(
//           "Updating neurological_exams with fields:",
//           neuroUpdateFields,
//           "values:",
//           values
//         );
//         await client.query(
//           `UPDATE neurological_exams SET ${setClause} WHERE consultation_id = $${values.length}`,
//           values
//         );
//       } else {
//         // Insert new row
//         const fields = ["consultation_id", ...neuroUpdateFields];
//         const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
//         const values = [
//           consultationId,
//           ...neuroUpdateFields.map((field) => data[field]),
//         ];
//         console.log(
//           "Inserting into neurological_exams with fields:",
//           fields,
//           "values:",
//           values
//         );
//         await client.query(
//           `INSERT INTO neurological_exams (${fields.join(
//             ", "
//           )}) VALUES (${placeholders})`,
//           values
//         );
//       }
//     }

//     // 3. Update symptoms (replace old with new)
//     if (Array.isArray(data.symptoms)) {
//       await client.query(
//         `DELETE FROM consultation_symptoms WHERE consultation_id = $1`,
//         [consultationId]
//       );
//       for (const symptomId of data.symptoms) {
//         await client.query(
//           `INSERT INTO consultation_symptoms (consultation_id, symptom_id) VALUES ($1, $2)`,
//           [consultationId, symptomId]
//         );
//       }
//     }

//     // 4. Update prescriptions (delete and re-insert)
//     if (Array.isArray(data.prescriptions)) {
//       await client.query(`DELETE FROM prescriptions WHERE consultation_id = $1`, [
//         consultationId,
//       ]);
//       for (const p of data.prescriptions) {
//         await client.query(
//           `INSERT INTO prescriptions 
//             (consultation_id, medicine_id, dosage_en, dosage_urdu, frequency_en, frequency_urdu, 
//             duration_en, duration_urdu, instructions_en, instructions_urdu, how_to_take_en, how_to_take_urdu, prescribed_at)
//            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
//           [
//             consultationId,
//             p.medicine_id,
//             p.dosage_en,
//             p.dosage_urdu,
//             p.frequency_en,
//             p.frequency_urdu,
//             p.duration_en,
//             p.duration_urdu,
//             p.instructions_en,
//             p.instructions_urdu,
//             p.how_to_take_en,
//             p.how_to_take_urdu,
//             p.prescribed_at || new Date().toISOString(), // Use frontend value if provided
//           ]
//         );
//       }
//     }

//     // 5. Update tests (replace all)
//     if (Array.isArray(data.tests)) {
//       // Validate test_ids
//       const validTestIds = [];
//       for (const testId of data.tests) {
//         if (!Number.isInteger(Number(testId))) {
//           throw new Error(`Invalid test ID: ${testId}. Test IDs must be integers.`);
//         }
//         const result = await client.query(`SELECT 1 FROM tests WHERE id = $1`, [testId]);
//         if (result.rowCount === 0) {
//           throw new Error(`Test ID ${testId} does not exist in the tests table.`);
//         }
//         validTestIds.push(testId);
//       }

//       await client.query(
//         `DELETE FROM consultation_tests WHERE consultation_id = $1`,
//         [consultationId]
//       );
//       for (const testId of validTestIds) {
//         console.log(`Inserting test_id: ${testId} for consultation_id: ${consultationId}`);
//         await client.query(
//           `INSERT INTO consultation_tests (consultation_id, test_id) VALUES ($1, $2)`,
//           [consultationId, testId]
//         );
//       }
//     }

//     // 6. Update vital signs
//     if (Array.isArray(data.vital_signs) && data.vital_signs.length > 0) {
//       const result = await client.query(
//         `SELECT patient_id FROM consultations WHERE id = $1`,
//         [consultationId]
//       );
//       const patientId = result.rows[0]?.patient_id;
//       if (!patientId) {
//         throw new Error("Patient ID not found for the given consultation");
//       }

//       await client.query(`DELETE FROM vital_signs WHERE consultation_id = $1`, [
//         consultationId,
//       ]);
//       for (const vital of data.vital_signs) {
//         await client.query(
//           `INSERT INTO vital_signs 
//             (consultation_id, patient_id, pulse_rate, blood_pressure, temperature, spo2_level, nihss_score, fall_assessment, created_at)
//            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
//           [
//             consultationId,
//             patientId,
//             vital.pulse_rate,
//             vital.blood_pressure,
//             vital.temperature,
//             vital.spo2_level,
//             vital.nihss_score,
//             vital.fall_assessment,
//           ]
//         );
//       }
//     }

//     if (Array.isArray(data.follow_ups)) {
//       await client.query(`DELETE FROM follow_ups WHERE consultation_id = $1`, [
//         consultationId,
//       ]);

//       for (const followUp of data.follow_ups) {
//         if (!followUp.follow_up_date) {
//           throw new Error("Follow-up date is required for all entries");
//         }

//         await client.query(
//           `INSERT INTO follow_ups 
//            (consultation_id, follow_up_date, notes)
//            VALUES ($1, $2, $3)`,
//           [consultationId, followUp.follow_up_date, followUp.notes || null]
//         );
//       }
//     }

//     await client.query("COMMIT");
//     res.json({ message: "Consultation updated successfully" });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error updating consultation:", error);
//     res
//       .status(500)
//       .json({ error: "Internal Server Error", details: error.message });
//   } finally {
//     if (client) client.release();
//   }
// };

// print consultation


const sanitizeString = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/['";]/g, "");
};

const safeParseInt = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

// Helper function for batch inserts
const batchInsert = async (client, table, columns, values, consultationId) => {
  if (values.length === 0) return;

  const columnArray = columns.split(',').map(col => col.trim());
  const totalColumns = columnArray.length;

  // Generate placeholders for each row
  const placeholders = values.map((_, i) => {
    const startIndex = i * (totalColumns - 1) + 2;
    return `($1, ${Array(totalColumns - 1).fill().map((_, j) => `$${startIndex + j}`).join(', ')})`;
  }).join(', ');

  const flatValues = values.flat();
  await client.query(
    `INSERT INTO ${table} (${columns}) VALUES ${placeholders}`,
    [consultationId, ...flatValues]
  );
};

// Neurological exam fields
const NEURO_FIELDS = [
  "diagnosis", "treatment_plan", "motor_function", "muscle_tone", "muscle_strength",
  "deep_tendon_reflexes", "plantar_reflex", "sensory_examination", "pain_sensation",
  "vibration_sense", "proprioception", "temperature_sensation", "coordination",
  "finger_nose_test", "heel_shin_test", "gait_assessment", "romberg_test",
  "cranial_nerves", "pupillary_reaction", "eye_movements", "facial_sensation",
  "swallowing_function", "tongue_movement", "straight_leg_raise_test", "lasegue_test",
  "brudzinski_sign", "kernig_sign", "cognitive_assessment", "speech_assessment",
  "tremors", "involuntary_movements", "notes", "fundoscopy", "mmse_score",
  "gcs_score", "straight_leg_raise_left", "straight_leg_raise_right", "power"
];

export const updateConsultationForPatient = async (req, res) => {
  const { consultationId } = req.params;
  const data = req.body;

  if (!consultationId) {
    return res.status(400).json({ error: "Consultation ID is required" });
  }

  if (!(await consultationOwned(consultationId, req.user))) {
    return res.status(404).json({ error: "Consultation not found" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify consultation exists and lock the row
    const { rows: [consultation], rowCount } = await client.query(
      `SELECT patient_id FROM consultations WHERE id = $1 FOR UPDATE`,
      [consultationId]
    );

    if (rowCount === 0) {
      throw new Error(`Consultation ID ${consultationId} not found`);
    }

    const patientId = consultation.patient_id;

    // 2. Update patient fields (optimized dynamic query)
    const patientUpdates = {};
    const allowedPatientFields = ['patient_name', 'age', 'gender', 'mobile'];

    allowedPatientFields.forEach(field => {
      if (data[field] !== undefined) {
        patientUpdates[field] = field === 'age' ? safeParseInt(data[field]) : sanitizeString(data[field]);
      }
    });

    if (Object.keys(patientUpdates).length > 0) {
      const setClause = Object.keys(patientUpdates)
        .map((key, i) => `${key === 'patient_name' ? 'name' : key} = $${i + 1}`)
        .join(', ');

      await client.query(
        `UPDATE patients SET ${setClause} WHERE id = $${Object.keys(patientUpdates).length + 1}`,
        [...Object.values(patientUpdates), patientId]
      );
    }

    // 3. Update consultation visit_date if provided
    if (data.visit_date) {
      await client.query(
        `UPDATE consultations SET visit_date = $1 WHERE id = $2`,
        [data.visit_date, consultationId]
      );
    }

    // 4. Process all batch operations in parallel
    await Promise.all([
      // Neurological exams
      data.neurological_exams && handleNeuroExamUpdate(client, consultationId, data.neurological_exams),
      // Symptoms
      Array.isArray(data.symptoms) && handleSymptomsUpdate(client, consultationId, data.symptoms),
      // Prescriptions
      Array.isArray(data.prescriptions) && handlePrescriptionsUpdate(client, consultationId, data.prescriptions),
      // Tests
      Array.isArray(data.tests) && handleTestsUpdate(client, consultationId, data.tests),
      // Vital signs
      Array.isArray(data.vital_signs) && handleVitalSignsUpdate(client, consultationId, patientId, data.vital_signs),
      // Follow-ups
      Array.isArray(data.follow_ups) && handleFollowUpsUpdate(client, consultationId, data.follow_ups)
    ]);

    await client.query("COMMIT");
    res.json({ message: "Consultation updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating consultation:", error);
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({ 
      error: statusCode === 404 ? "Not Found" : "Bad Request",
      details: error.message 
    });
  } finally {
    client.release();
  }
};

// Helper function for neurological exam updates
async function handleNeuroExamUpdate(client, consultationId, examData) {
  const updateFields = NEURO_FIELDS.filter(field => examData[field] !== undefined);
  if (updateFields.length === 0) return;

  const { rowCount } = await client.query(
    `SELECT 1 FROM neurological_exams WHERE consultation_id = $1`,
    [consultationId]
  );

  if (rowCount > 0) {
    const setClause = updateFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE neurological_exams SET ${setClause} WHERE consultation_id = $${updateFields.length + 1}`,
      [...updateFields.map(f => examData[f]), consultationId]
    );
  } else {
    const fields = ["consultation_id", ...updateFields];
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO neurological_exams (${fields.join(', ')}) VALUES (${placeholders})`,
      [consultationId, ...updateFields.map(f => examData[f])]
    );
  }
}

// Helper function for symptoms update
async function handleSymptomsUpdate(client, consultationId, symptoms) {
  await client.query(
    'DELETE FROM consultation_symptoms WHERE consultation_id = $1', 
    [consultationId]
  );

  if (symptoms.length === 0) return;

  const validSymptoms = symptoms
    .map(safeParseInt)
    .filter(id => id !== null);

  if (validSymptoms.length === 0) return;

  await batchInsert(
    client,
    'consultation_symptoms',
    'consultation_id, symptom_id',
    validSymptoms.map(id => [id]),
    consultationId
  );
}

// Helper function for prescriptions update
async function handlePrescriptionsUpdate(client, consultationId, prescriptions) {
  await client.query(
    'DELETE FROM prescriptions WHERE consultation_id = $1', 
    [consultationId]
  );

  const validPrescriptions = prescriptions.filter(p => p && safeParseInt(p.medicine_id) !== null);

  if (validPrescriptions.length === 0) return;

  await batchInsert(
    client,
    'prescriptions',
    'consultation_id, medicine_id, dosage_en, dosage_urdu, frequency_en, frequency_urdu, duration_en, duration_urdu, instructions_en, instructions_urdu, how_to_take_en, how_to_take_urdu, prescribed_at',
    validPrescriptions.map(p => [
      safeParseInt(p.medicine_id),
      sanitizeString(p.dosage_en || ''),
      sanitizeString(p.dosage_urdu || ''),
      sanitizeString(p.frequency_en || ''),
      sanitizeString(p.frequency_urdu || ''),
      sanitizeString(p.duration_en || ''),
      sanitizeString(p.duration_urdu || ''),
      sanitizeString(p.instructions_en || ''),
      sanitizeString(p.instructions_urdu || ''),
      sanitizeString(p.how_to_take_en || ''),
      sanitizeString(p.how_to_take_urdu || ''),
      p.prescribed_at || new Date().toISOString()
    ]),
    consultationId
  );
}

// Helper function for tests update
async function handleTestsUpdate(client, consultationId, tests) {
  await client.query(
    'DELETE FROM consultation_tests WHERE consultation_id = $1', 
    [consultationId]
  );

  const validTestIds = tests
    .map(safeParseInt)
    .filter(id => id !== null);

  if (validTestIds.length === 0) return;

  await batchInsert(
    client,
    'consultation_tests',
    'consultation_id, test_id',
    validTestIds.map(id => [id]),
    consultationId
  );
}

// Helper function for vital signs update
async function handleVitalSignsUpdate(client, consultationId, patientId, vitalSigns) {
  await client.query(
    'DELETE FROM vital_signs WHERE consultation_id = $1', 
    [consultationId]
  );

  if (vitalSigns.length === 0) return;

  await batchInsert(
    client,
    'vital_signs',
    'consultation_id, patient_id, pulse_rate, blood_pressure, temperature, spo2_level, nihss_score, fall_assessment, created_at',
    vitalSigns.map(vital => [
      patientId,
      vital.pulse_rate || null,
      vital.blood_pressure || null,
      vital.temperature || null,
      vital.spo2_level || null,
      vital.nihss_score || null,
      vital.fall_assessment || null,
      new Date().toISOString()
    ]),
    consultationId
  );
}

// Helper function for follow-ups update
async function handleFollowUpsUpdate(client, consultationId, followUps) {
  await client.query(
    'DELETE FROM follow_ups WHERE consultation_id = $1', 
    [consultationId]
  );

  const validFollowUps = followUps.filter(f => f && f.follow_up_date);

  if (validFollowUps.length === 0) return;

  await batchInsert(
    client,
    'follow_ups',
    'consultation_id, follow_up_date, notes',
    validFollowUps.map(f => [
      f.follow_up_date,
      sanitizeString(f.notes || '')
    ]),
    consultationId
  );
}


// Print / PDF handlers live in their own files (they were ~1300 lines of
// HTML templates). Re-exported here so route imports stay stable.
export { printConsultationForPatient } from "./patientHistory/printConsultation.js";
export { generatePrescriptionPDF } from "./patientHistory/prescriptionPdf.js";
