import { pool } from "../models/db.js";

// export const createPrescription = async (req, res) => {
//     try {
//         const { consultation_id, medicines } = req.body;

//         if (!medicines || !Array.isArray(medicines)) {
//             return res.status(400).json({ error: "Invalid data format. 'medicines' must be an array." });
//         }

//         // Fetch patient_id from the consultation
//         const patientQuery = await pool.query(
//             "SELECT patient_id FROM consultations WHERE id = $1",
//             [consultation_id]
//         );

//         if (patientQuery.rowCount === 0) {
//             return res.status(404).json({ error: "Consultation not found" });
//         }

//         const patient_id = patientQuery.rows[0].patient_id;

//         // Insert prescriptions
//         const prescriptions = await Promise.all(
//             medicines.map(async (med) => {
//                 const medId = parseInt(med.medicine_id);

//                 if (isNaN(medId)) {
//                     throw new Error("Invalid or missing medicine_id. It must be a number.");
//                 }

//                 // Check if the medicine exists
//                 const medCheck = await pool.query("SELECT id FROM medicines WHERE id = $1", [medId]);
//                 if (medCheck.rowCount === 0) {
//                     throw new Error(`Medicine with ID ${medId} does not exist.`);
//                 }

//                 const result = await pool.query(
//                     `INSERT INTO prescriptions
//                      (consultation_id, patient_id, medicine_id,
//                      dosage_en, dosage_urdu,
//                      frequency_en, frequency_urdu,
//                      duration_en, duration_urdu,
//                      instructions_en, instructions_urdu,
//                      how_to_take_en, how_to_take_urdu)
//                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
//                      RETURNING *`,
//                     [
//                         consultation_id,
//                         patient_id,
//                         medId,
//                         med.dosage_en,
//                         med.dosage_urdu,
//                         med.frequency_en,
//                         med.frequency_urdu,
//                         med.duration_en,
//                         med.duration_urdu,
//                         med.instructions_en,
//                         med.instructions_urdu,
//                         med.how_to_take_en,
//                         med.how_to_take_urdu
//                     ]
//                 );

//                 return result.rows[0];
//             })
//         );

//         res.status(201).json(prescriptions);
//     } catch (error) {
//         console.error("Error Inserting Prescription:", error);
//         res.status(400).json({ error: error.message });
//     }
// };

// export const createPrescription = async (req, res) => {
//   try {
//     const { consultation_id, medicines } = req.body;

//     if (!consultation_id || !medicines || !Array.isArray(medicines)) {
//       return res
//         .status(400)
//         .json({
//           error:
//             "Invalid data format. 'consultation_id' and 'medicines' (array) are required.",
//         });
//     }

//     // Fetch patient_id from the consultation
//     const patientQuery = await pool.query(
//       "SELECT patient_id FROM consultations WHERE id = $1",
//       [consultation_id]
//     );

//     if (patientQuery.rowCount === 0) {
//       return res.status(404).json({ error: "Consultation not found" });
//     }

//     const patient_id = patientQuery.rows[0].patient_id;

//     // Insert prescriptions
//     const prescriptions = await Promise.all(
//       medicines.map(async (med) => {
//         const medId = parseInt(med.medicine_id);

//         if (isNaN(medId)) {
//           throw new Error(
//             "Invalid or missing medicine_id. It must be a number."
//           );
//         }

//         // Check if the medicine exists
//         const medCheck = await pool.query(
//           "SELECT id FROM medicines WHERE id = $1",
//           [medId]
//         );
//         if (medCheck.rowCount === 0) {
//           throw new Error(`Medicine with ID ${medId} does not exist.`);
//         }

//         // Validate required fields
//         const requiredFields = [
//           "dosage_en",
//           "dosage_urdu",
//           "frequency_en",
//           "frequency_urdu",
//           "duration_en",
//           "duration_urdu",
//           "instructions_en",
//           "instructions_urdu",
//         ];
//         for (const field of requiredFields) {
//           if (!med[field] || typeof med[field] !== "string") {
//             throw new Error(`Invalid or missing field: ${field}`);
//           }
//         }

//         const result = await pool.query(
//           `INSERT INTO prescriptions
//              (consultation_id, patient_id, medicine_id,
//              dosage_en, dosage_urdu,
//              frequency_en, frequency_urdu,
//              duration_en, duration_urdu,
//              instructions_en, instructions_urdu,
//              how_to_take_en, how_to_take_urdu)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
//              RETURNING *`,
//           [
//             consultation_id,
//             patient_id,
//             medId,
//             med.dosage_en,
//             med.dosage_urdu,
//             med.frequency_en,
//             med.frequency_urdu,
//             med.duration_en,
//             med.duration_urdu,
//             med.instructions_en,
//             med.instructions_urdu,
//             med.how_to_take_en || null, // Allow null for optional fields
//             med.how_to_take_urdu || null,
//           ]
//         );

//         return result.rows[0];
//       })
//     );

//     res.status(201).json(prescriptions);
//   } catch (error) {
//     console.error("Error Inserting Prescription:", error);

//     // Differentiate between client and server errors
//     if (
//       error.message.includes(
//         "Cannot use a pool after calling end on the pool"
//       ) ||
//       error.message.includes("database connection")
//     ) {
//       return res
//         .status(500)
//         .json({ error: "Database connection error. Please try again later." });
//     }

//     res.status(400).json({ error: error.message });
//   }
// };


export const createPrescription = async (req, res) => {
  const { consultation_id, medicines } = req.body;

  if (!consultation_id || !medicines || !Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({
      error: "Invalid data format. 'consultation_id' and 'medicines' (non-empty array) are required.",
    });
  }

  // Validate all medicine_ids are integers up-front (no DB call yet)
  const medIds = [];
  for (let i = 0; i < medicines.length; i++) {
    const med = medicines[i];
    const medId = parseInt(med.medicine_id);
    if (isNaN(medId)) {
      return res.status(400).json({ error: `Invalid medicine_id at index ${i}. Must be a number.` });
    }
    const requiredFields = ["dosage_en", "dosage_urdu", "frequency_en", "frequency_urdu", "duration_en", "duration_urdu", "instructions_en", "instructions_urdu"];
    for (const field of requiredFields) {
      if (!med[field] || typeof med[field] !== "string") {
        return res.status(400).json({ error: `Invalid or missing field '${field}' at index ${i}` });
      }
    }
    medIds.push(medId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Single query: get patient_id and validate consultation
    const consultationQuery = await client.query(
      "SELECT patient_id FROM consultations WHERE id = $1",
      [consultation_id]
    );
    if (consultationQuery.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Consultation not found" });
    }
    const patient_id = consultationQuery.rows[0].patient_id;

    // Single query: validate all medicine IDs at once
    const medCheck = await client.query(
      "SELECT id FROM medicines WHERE id = ANY($1::int[])",
      [medIds]
    );
    if (medCheck.rowCount !== medIds.length) {
      const validIds = new Set(medCheck.rows.map((r) => r.id));
      const invalid = medIds.filter((id) => !validIds.has(id));
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Medicine IDs do not exist: ${invalid.join(", ")}` });
    }

    // Bulk insert all prescriptions in a single query
    const valuePlaceholders = medicines.map((_, i) => {
      const base = i * 13;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, NOW())`;
    }).join(", ");

    const values = medicines.flatMap((med, i) => [
      consultation_id,
      patient_id,
      medIds[i],
      med.dosage_en,
      med.dosage_urdu,
      med.frequency_en,
      med.frequency_urdu,
      med.duration_en,
      med.duration_urdu,
      med.instructions_en,
      med.instructions_urdu,
      med.how_to_take_en ?? null,
      med.how_to_take_urdu ?? null,
    ]);

    const result = await client.query(
      `INSERT INTO prescriptions
       (consultation_id, patient_id, medicine_id, dosage_en, dosage_urdu,
        frequency_en, frequency_urdu, duration_en, duration_urdu,
        instructions_en, instructions_urdu, how_to_take_en, how_to_take_urdu, prescribed_at)
       VALUES ${valuePlaceholders} RETURNING *`,
      values
    );

    await client.query("COMMIT");
    res.status(201).json(result.rows);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error Inserting Prescription:", error);
    if (error.code === "23505") {
      return res.status(400).json({ error: "Duplicate prescription entry detected." });
    }
    res.status(500).json({ error: "Failed to create prescriptions", details: error.message });
  } finally {
    client.release();
  }
};

export const getPrintablePrescription = async (req, res) => {
  try {
    const { consultation_id } = req.params;
    const result = await pool.query(
      `SELECT p.*, m.brand_name, m.urdu_name, m.form, m.strength 
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.id
             WHERE p.consultation_id = $1`,
      [consultation_id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPrescriptionsByPatient = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const result = await pool.query(
      `SELECT p.*, m.brand_name, m.urdu_name, m.form, m.strength 
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.id
             WHERE p.patient_id = $1`,
      [patient_id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "No prescriptions found for this patient." });
    }

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPrescriptionsByConsultationId = async (req, res) => {
  try {
    const { consultation_id } = req.params;
    const result = await pool.query(
      `SELECT p.*, m.brand_name, m.urdu_name, m.form, m.strength 
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.id
             WHERE p.consultation_id = $1`,
      [consultation_id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "No prescriptions found for this consultation." });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error Fetching Prescription:", error);
    res.status(500).json({ error: error.message });
  }
};
