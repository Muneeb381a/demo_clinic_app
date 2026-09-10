// src/controllers/patientHistory/printConsultation.js
// GET /api/patients/:patientId/consultations/:consultationId/print
// Printable HTML consultation summary. Moved verbatim from the former
// 3000-line getPatientHistory.js.

import { pool } from "../../models/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { consultationOwned } from "../../middleware/scope.js";
import { urduDate } from "./shared.js";

export const printConsultationForPatient = async (req, res) => {
  const { patientId, consultationId } = req.params;

  try {
    if (!patientId || !consultationId) {
      throw new ApiError("Patient ID and Consultation ID are required", 400);
    }

    if (!(await consultationOwned(consultationId, req.user))) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    // Fetch consultation data (reuse getSpecificConsultationForPatient logic)
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
          JOIN consultations c ON p.id = c.patient_id
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
    JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
      'medicine', JSONB_BUILD_OBJECT(  -- Add nested medicine object
        'form', m.form,
        'brand_name', m.brand_name,
        'strength', m.strength
      ),
      'dosage_urdu', pr.dosage_urdu,
      'frequency_urdu', pr.frequency_urdu,
      'duration_urdu', pr.duration_urdu,
      'instructions_urdu', pr.instructions_urdu
    )) AS prescriptions
  FROM prescriptions pr
  LEFT JOIN medicines m ON pr.medicine_id = m.id
  WHERE pr.consultation_id = $2
  GROUP BY pr.consultation_id
),
test_data AS (
  SELECT 
    ct.consultation_id,
    JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT( -- Changed to JSONB_AGG
      'test_name', t.test_name
    )) AS tests
  FROM consultation_tests ct
  LEFT JOIN tests t ON ct.test_id = t.id
  WHERE ct.consultation_id = $2
  GROUP BY ct.consultation_id
),
vital_signs_data AS (
  SELECT 
    vs.consultation_id,
    JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT( -- Changed to JSONB_AGG
      'pulse_rate', vs.pulse_rate,
      'blood_pressure', vs.blood_pressure,
      'temperature', vs.temperature,
      'spo2_level', vs.spo2_level,
      'nihss_score', vs.nihss_score,
      'fall_assessment', vs.fall_assessment
    )) AS vital_signs
  FROM vital_signs vs
  WHERE vs.consultation_id = $2
  GROUP BY vs.consultation_id
),
follow_ups_data AS (
  SELECT 
    consultation_id,
    JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT( -- Changed to JSONB_AGG
      'follow_up_date', follow_up_date,
      'notes', notes,
      'created_at', created_at
    )) AS follow_ups
  FROM follow_ups
  WHERE consultation_id = $2
  GROUP BY consultation_id
)
      SELECT 
  pd.*,
  COALESCE(sd.symptoms, ARRAY[]::TEXT[]) AS symptoms, 
  COALESCE(prd.prescriptions, '[]'::JSONB) AS prescriptions,
  COALESCE(td.tests, '[]'::JSONB) AS tests,
  COALESCE(vsd.vital_signs, '[]'::JSONB) AS vital_signs,
  COALESCE(fud.follow_ups, '[]'::JSONB) AS follow_ups
FROM patient_data pd
LEFT JOIN symptom_data sd ON pd.consultation_id = sd.consultation_id
LEFT JOIN prescription_data prd ON pd.consultation_id = prd.consultation_id
LEFT JOIN test_data td ON pd.consultation_id = td.consultation_id
LEFT JOIN vital_signs_data vsd ON pd.consultation_id = vsd.consultation_id
LEFT JOIN follow_ups_data fud ON pd.consultation_id = fud.consultation_id;
    `;

    const result = await pool.query(query, [patientId, consultationId]);
    if (result.rows.length === 0) {
      throw new ApiError("Consultation not found for this patient", 404);
    }

    const consultation = result.rows[0];

    // Process data with proper fallbacks
    const processArray = (data) => (Array.isArray(data) ? data : []);

    const patient = {
      name: consultation.patient_name || "Unknown Patient",
      mobile: consultation.mobile || "-",
      age: consultation.age || "-",
      gender: consultation.gender || "-",
    };

    const vitalSigns = processArray(consultation.vital_signs)[0] || {};
    const selectedSymptoms = processArray(consultation.symptoms).map((s) => ({
      label: s,
    }));
    const selectedTests = processArray(consultation.tests).map(
      (t) => t.test_name
    );
    const followUps = processArray(consultation.follow_ups);

    // Fix medicine display
    const medicines = processArray(consultation.prescriptions).map((p) => ({
      ...p,
      medicineName: [
        p.medicine?.form,
        p.medicine?.brand_name,
        p.medicine?.strength ? `(${p.medicine.strength})` : null,
      ]
        .filter(Boolean)
        .join(" "),
    }));
    const neuroExamData = {
      diagnosis: consultation.neuro_diagnosis,
      treatment_plan: consultation.neuro_treatment_plan,
      motor_function: consultation.motor_function,
      muscle_tone: consultation.muscle_tone,
      muscle_strength: consultation.muscle_strength,
      deep_tendon_reflexes: consultation.deep_tendon_reflexes,
      plantar_reflex: consultation.plantar_reflex,
      sensory_examination: consultation.sensory_examination,
      pain_sensation: consultation.pain_sensation,
      vibration_sense: consultation.vibration_sense,
      proprioception: consultation.proprioception,
      temperature_sensation: consultation.temperature_sensation,
      coordination: consultation.coordination,
      finger_nose_test: consultation.finger_nose_test,
      heel_shin_test: consultation.heel_shin_test,
      gait_assessment: consultation.gait_assessment,
      romberg_test: consultation.romberg_test,
      cranial_nerves: consultation.cranial_nerves,
      pupillary_reaction: consultation.pupillary_reaction,
      eye_movements: consultation.eye_movements,
      facial_sensation: consultation.facial_sensation,
      swallowing_function: consultation.swallowing_function,
      tongue_movement: consultation.tongue_movement,
      straight_leg_raise_test: consultation.straight_leg_raise_test,
      lasegue_test: consultation.lasegue_test,
      brudzinski_sign: consultation.brudzinski_sign,
      kernig_sign: consultation.kernig_sign,
      cognitive_assessment: consultation.cognitive_assessment,
      speech_assessment: consultation.speech_assessment,
      tremors: consultation.tremors,
      involuntary_movements: consultation.involuntary_movements,
      notes: consultation.notes,
      fundoscopy: consultation.fundoscopy,
      mmse_score: consultation.mmse_score,
      gcs_score: consultation.gcs_score,
      straight_leg_raise_left: consultation.straight_leg_raise_left,
      straight_leg_raise_right: consultation.straight_leg_raise_right,
      power: consultation.power
    };

    const neuroFields = [
      { label: "Motor Function", key: "motor_function" },
      { label: "Muscle Tone", key: "muscle_tone" },
      { label: "Muscle Strength", key: "muscle_strength" },
      { label: "SLR Left", key: "straight_leg_raise_left" },
      { label: "SLR Right", key: "straight_leg_raise_right" },
      { label: "Reflexes", key: "deep_tendon_reflexes" },
      { label: "Gait", key: "gait_assessment" },
      { label: "Plantars", key: "plantar_reflex" },
      { label: "Pupils", key: "pupillary_reaction" },
      { label: "Speech", key: "speech_assessment" },
      { label: "Coordination", key: "coordination" },
      { label: "Sensory Exam", key: "sensory_examination" },
      { label: "Cranial Nerves", key: "cranial_nerves" },
      { label: "Romberg Test", key: "romberg_test" },
      { label: "Fundoscopy", key: "fundoscopy" },
      { label: "MMSE Score", key: "mmse_score" },
      { label: "GCS Score", key: "gcs_score" },
      { label: "Sensation", key: "pain_sensation", type: "check" },
      { label: "Vibration Sense", key: "vibration_sense", type: "check" },
      { label: "Proprioception", key: "proprioception", type: "check" },
      { label: "Temp Sensation", key: "temperature_sensation", type: "check" },
      { label: "Brudzinski Sign", key: "brudzinski_sign", type: "check" },
      { label: "Kernig Sign", key: "kernig_sign", type: "check" },
      { label: "Facial Sensation", key: "facial_sensation", type: "check" },
      { label: "Swallowing", key: "swallowing_function", type: "check" },
      { label: "Diagnosis", key: "diagnosis" },
      { label: "Treatment Plan", key: "treatment_plan" },
      {label: "Power", key: "power"},
    ];

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Generate HTML
    const htmlContent = `
  <html>
    <head>
      <title>Prescription - ${patient?.name || "Unknown Patient"}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          margin: 20mm 15mm;
          color: #374151;
          font-size: 11px;
          line-height: 1.1;
        }
        .prescription-container {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 3mm;
          margin-top: 5mm;
        }
        .patient-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 3mm;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .patient-table th,
        .patient-table td {
          padding: 1mm 2mm;
          border: 1px solid #e2e8f0;
          text-align: left;
        }
        .patient-table td {
          background: #e2e8f0;
          font-size: 10px;
          width: 25%;
        }
        .section-title {
          font-weight: 600;
          color: #1e40af;
          padding-bottom: 1mm;
          margin-bottom: 1mm;
          border-bottom: 2px solid #1e40af;
        }
        .medicine-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1mm 0;
        }
        .medicine-table th {
          padding: 1mm 1mm;
          font-weight: 600;
          font-size: 11px;
          background: #eff6ff;
          border-bottom: 2px solid #1e40af;
          vertical-align: middle;
        }
        .medicine-table th:first-child {
          text-align: left;
          font-family: 'Noto Nastaliq Urdu', serif;
          font-size: 11px;
        }
        .medicine-table th:not(:first-child) {
          text-align: center;
          font-family: 'Noto Nastaliq Urdu', serif;
        }
        .medicine-table td {
          padding: 1mm 1mm;
          border-bottom: 1px solid #e5e7eb;
          font-size: 10px;
          vertical-align: middle;
        }
        .medicine-table td:first-child {
          text-align: left;
          font-family: 'Roboto', sans-serif;
          font-weight: 600;
        }
        .medicine-table td:not(:first-child) {
          text-align: center;
          font-family: 'Noto Nastaliq Urdu', serif;
        }
        .clinical-section {
          margin-bottom: 0.5mm;
          padding: 1mm;
          background: #f8fafc;
        }
        .clinical-paragraph {
          text-align: justify;
          color: #475569;
        }
        .clinical-paragraph strong {
          color: #1e293b;
        }
        .vital-signs {
          margin-bottom: 2mm;
        }
        .vital-label {
          font-weight: 500;
        }
        .vital-value {
          margin-right: 2mm;
        }
        .vital-unit {
          font-size: 8px;
          color: #6b7280;
        }
        .no-vitals {
          color: #6b7280;
          font-size: 9px;
          margin-top: 2mm;
        }
        .follow-up-section {
          margin-top: 1mm;
          padding: 3mm;
          background: #f0fdfa;
        }
        .follow-up-content {
          display: flex;
          justify-content: space-between;
          gap: 5mm;
        }
        .urdu-date {
          font-family: 'Noto Nastaliq Urdu', serif;
          direction: rtl;
          color: #4b5563;
        }
        .urdu-dates {
          text-align: center;
          vertical-align: middle;
          font-family: 'Noto Nastaliq Urdu', serif;
          font-size: 0.8rem;
          padding: 8px;
          direction: rtl;
        }
        .urdu-date-highlight {
          color: #1e40af;
          font-weight: 500;
        }
        .notes {
          font-size: 13px;
        }
        .urdu-dates {
          text-align: center;
          vertical-align: middle;
          font-family: 'Noto Nastaliq Urdu', serif;
          font-size: 0.8rem;
          padding: 8px;
        }
        .center-th {
          text-align: center;
          vertical-align: middle;
          padding: 8px;
        }
        .patient-name {
          font-size: 14px;
          font-weight: bold;
        }
          .follow-up-section {
  margin-top: 15px;
  border-top: 2px solid #1e40af;
  padding-top: 10px;
}

.follow-up-item {
  margin-bottom: 10px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 4px;
}

.follow-up-item:last-child {
  margin-bottom: 0;
}

.follow-up-meta {
  margin-top: 5px;
  font-size: 0.75rem;
  color: #6b7280;
}
        @media print {
          .medicine-table td {
            font-size: 11px;
          }
          @page {
            margin: 0 !important;
          }
          body {
            margin: 69.85mm 9mm 76.2mm !important;
          }
          .section-title {
            color: #1e3a8a !important;
          }
        }
      </style>
    </head>
    <body>
      <table class="patient-table">
        <tbody>
          <tr>
            <td class="name">
              <strong>Name:</strong>
              <span class="patient-name">${patient?.name || "-"}</span>
            </td>
            <td><strong>Age/Sex:</strong> ${patient?.age || "-"}/${
      patient?.gender || "-"
    }</td>
            <td><strong>Mobile:</strong> ${patient?.mobile || "-"}</td>
          </tr>
        </tbody>
      </table>
      <div class="prescription-container">
        <!-- Medicines Column -->
        <div class="column">
          <div class="section-title">PRESCRIPTION</div>
          <table class="medicine-table">
            <thead>
              <tr>
                <th class="urdu-date center-th">ادویات</th>
                <th class="urdu-date center-th">اوقات</th>
                <th class="urdu-date center-th">تعداد</th>
                <th class="urdu-date center-th">مدت</th>
                <th class="urdu-date center-th">طریقہ کار</th>
              </tr>
            </thead>
            <tbody>
              ${medicines
                .map((med) => {
                  const medicineName = [
                    med.medicine?.form,
                    med.medicine?.brand_name,
                    med.medicine?.strength
                      ? `(${med.medicine.strength})`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return `
                    <tr>
                      <td>${medicineName}</td>
                      <td class="urdu-dates">${med.frequency_urdu || "-"}</td>
                      <td class="urdu-dates">${med.dosage_urdu || "-"}</td>
                      <td class="urdu-dates">${med.duration_urdu || "-"}</td>
                      <td class="urdu-dates">${
                        med.instructions_urdu || "-"
                      }</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
        <!-- Clinical Findings Column -->
        <div class="column">
          <div class="section-title">CLINICAL FINDINGS</div>
          <div class="clinical-section">
            <div class="clinical-paragraph">
              ${
                vitalSigns.bloodPressure ||
                vitalSigns.pulseRate ||
                vitalSigns.temperature ||
                vitalSigns.spo2 ||
                vitalSigns.nihss ||
                vitalSigns.fall_assessment
                  ? `
                    <div class="vital-signs">
                      <strong>Vital Signs:</strong>
                      ${
                        vitalSigns.bloodPressure
                          ? `<span class="vital-label">BP:</span> <span class="vital-value">${vitalSigns.bloodPressure}</span> <span class="vital-unit">mmHg</span>`
                          : ""
                      }
                      ${
                        vitalSigns.pulseRate
                          ? `<span class="vital-label">Pulse:</span> <span class="vital-value">${vitalSigns.pulseRate}</span> <span class="vital-unit">bpm</span>`
                          : ""
                      }
                      ${
                        vitalSigns.temperature
                          ? `<span class="vital-label">Temp:</span> <span class="vital-value">${vitalSigns.temperature}</span> <span class="vital-unit">°C</span>`
                          : ""
                      }
                      ${
                        vitalSigns.spo2
                          ? `<span class="vital-label">SpO₂:</span> <span class="vital-value">${vitalSigns.spo2}</span> <span class="vital-unit">%</span>`
                          : ""
                      }
                      ${
                        vitalSigns.nihss
                          ? `<span class="vital-label">NIHSS:</span> <span class="vital-value">${vitalSigns.nihss}</span> <span class="vital-unit">/42</span>`
                          : ""
                      }
                      ${
                        vitalSigns.fall_assessment
                          ? `<span class="vital-label">Fall Risk:</span> <span class="vital-value">${vitalSigns.fall_assessment}</span>`
                          : ""
                      }
                    </div>
                  `
                  : `<div class="no-vitals">No vital signs recorded</div>`
              }
            </div>
            <div class="clinical-paragraph">
              <strong>Symptoms:</strong>
              ${
                selectedSymptoms.length > 0
                  ? selectedSymptoms.map((s) => s.label).join(", ") + "."
                  : "No symptoms noted."
              }
            </div>
            <div class="clinical-paragraph">
              <strong>Recommended Tests:</strong>
              ${
                selectedTests.length > 0
                  ? selectedTests.join(", ") + "."
                  : "No tests recommended."
              }
            </div>
            <div class="clinical-paragraph">
              <strong>Examination:</strong>
              ${
                neuroFields
                  .filter(({ key }) => {
                    const value = neuroExamData[key];
                    return (
                      value !== undefined &&
                      value !== null &&
                      (typeof value !== "string" || value.trim() !== "")
                    );
                  })
                  .map(({ label, key, type }) => {
                    const value = neuroExamData[key];
                    const displayValue =
                      type === "check"
                        ? value
                          ? "Positive"
                          : "Negative"
                        : value || "-";
                    return `${label}: ${displayValue}`;
                  })
                  .join("; ") + "."
              }
            </div>
          </div>
        </div>
      </div>
      ${
        followUps.length > 0
          ? `
          <div class="follow-up-section">
            <div class="section-title">FOLLOW UPS</div>
            ${followUps
              .map(
                (followUp) => `
              <div class="follow-up-item">
                <div class="follow-up-content">
                  <div>
                    <strong>Date:</strong> 
                    ${new Date(followUp.follow_up_date).toLocaleDateString(
                      "en-GB",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </div>
                  <div class="urdu-date">
                    <span>
                      برائے مہربانی 
                      <span class="urdu-date-highlight">
                        ${urduDate(followUp.follow_up_date)}
                      </span>
                      کو دوبارہ تشریف لائیں
                    </span>
                  </div>
                  ${
                    followUp.notes
                      ? `
                    <div class="notes">
                      <strong>Notes:</strong> ${followUp.notes}
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
          : ""
      }
    </body>
  </html>
`;

    const allowedOrigins = [
      process.env.LOCAL_ORIGIN,
      process.env.PRODUCTION_ORIGIN,
    ]
      .filter(Boolean)
      .map((origin) => origin.replace(/[^a-zA-Z0-9-.:/]/g, ""));

    const cspDirectives = [
      `default-src 'self'`,
      `script-src 'self'${
        process.env.NODE_ENV === "development" ? " 'unsafe-inline'" : ""
      }`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com`,
      `img-src 'self' data:`,
      `frame-ancestors 'self' ${allowedOrigins.join(" ")}`,
      `form-action 'self'`,
    ].join("; ");

    // Set response headers
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", cspDirectives);
    res.setHeader("Vary", "Origin");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // ********** CRUCIAL FIX: Send the HTML response **********
    res.status(200).send(htmlContent);
  } catch (error) {
    console.error("Error generating print consultation:", error);

    // Improved error handling
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    if (res.headersSent) {
      console.error("Headers already sent, cannot send error response");
      return;
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
