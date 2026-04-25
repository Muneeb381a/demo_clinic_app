const urduDate = (date) => {
  const urduMonths = [
    "جنوری",
    "فروری",
    "مارچ",
    "اپریل",
    "مئی",
    "جون",
    "جولائی",
    "اگست",
    "ستمبر",
    "اکتوبر",
    "نومبر",
    "دسمبر",
  ];
  const d = new Date(date);
  const day = d.getDate();
  const month = urduMonths[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const englishDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const printConsultation = ({
  patient,
  selectedMedicines,
  medicines,
  vitalSigns,
  selectedSymptoms,
  selectedTests,
  tests,
  neuroExamData,
  followUpDate,
  followUpNotes,
}) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Pop-up blocked! Allow pop-ups for this site.");
    return;
  }

  // Detailed logging
  console.log("Print inputs:", {
    selectedMedicines,
    medicines: medicines.map((m) => ({
      value: m.value,
      label: m.label,
      raw: m.raw,
    })),
  });

  // Validate medicines
  const invalidMedicines = selectedMedicines.filter(
    (med) =>
      med.medicine_id &&
      !medicines.some((m) => m.value === String(med.medicine_id))
  );
  if (invalidMedicines.length > 0) {
    console.warn("Invalid medicine IDs in print:", invalidMedicines);
    console.log(
      "Available medicine IDs:",
      medicines.map((m) => m.value)
    );
    alert(
      `Cannot print: Some medicines (IDs: ${invalidMedicines
        .map((m) => m.medicine_id)
        .join(
          ", "
        )}) are not recognized. Please reselect medicines or create new ones in the Prescription Management section.`
    );
    printWindow.close();
    return;
  }

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
    { label: "Mental Status", key: "mental_status" },
    { label: "Cerebellar Function", key: "cerebellar_function" },
    { label: "Muscle Wasting", key: "muscle_wasting" },
    { label: "Abnormal Movements", key: "abnormal_movements" },
    { label: "Romberg Test", key: "romberg_test" },
    { label: "Nystagmus", key: "nystagmus" },
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
    {label: "Power", key: "power"}
  ];

  printWindow.document.write(`
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
           .date-header {
            text-align: right;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: #4b5563;
            margin-bottom: 2mm;
          }
          }
          .follow-up-section {
            margin-top: 1mm;
            padding: 3mm;
            background: #f0fdfa;
          }
          .urdu-date {
            font-family: 'Noto Nastaliq Urdu', serif;
            direction: rtl;
            color: #4b5563;
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
            direction: rtl;
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
        <div class="date-header">${englishDate(new Date())}</div>
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
          <div class="column" style="border-right: 2px solid #1e40af;">
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
                ${(() => {
                  const courseCounters = {};
                  const totalPerMed = {};
                  selectedMedicines.forEach((m) => {
                    const id = String(m.medicine_id);
                    totalPerMed[id] = (totalPerMed[id] || 0) + 1;
                  });
                  return selectedMedicines
                  .map((med) => {
                    const medicineData = medicines.find(
                      (m) => m.value === String(med.medicine_id)
                    );
                    let medicineName = "Unknown Medicine";
                    if (medicineData && medicineData.raw) {
                      const { form, brand_name, strength } = medicineData.raw;
                      medicineName = [
                        form || "Tablet",
                        brand_name || "Unknown",
                        strength ? `(${strength})` : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                    }
                    const id = String(med.medicine_id);
                    courseCounters[id] = (courseCounters[id] || 0) + 1;
                    if (totalPerMed[id] > 1) {
                      medicineName += ` (Course ${courseCounters[id]})`;
                    }
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
                  .join("");
                })()}
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
                            ? `<span class="vital-label">BP:</span> <span class="vital-value">${vitalSigns.bloodPressure}</span> <span style="font-size: 8px; color: #6b7280;">mmHg</span>`
                            : ""
                        }
                        ${
                          vitalSigns.pulseRate
                            ? `<span class="vital-label">Pulse:</span> <span class="vital-value">${vitalSigns.pulseRate}</span> <span style="font-size: 8px; color: #6b7280;">bpm</span>`
                            : ""
                        }
                        ${
                          vitalSigns.temperature
                            ? `<span class="vital-label">Temp:</span> <span class="vital-value">${vitalSigns.temperature}</span> <span style="font-size: 8px; color: #6b7280;">°C</span>`
                            : ""
                        }
                        ${
                          vitalSigns.spo2
                            ? `<span class="vital-label">SpO₂:</span> <span class="vital-value">${vitalSigns.spo2}</span> <span style="font-size: 8px; color: #6b7280;">%</span>`
                            : ""
                        }
                        ${
                          vitalSigns.nihss
                            ? `<span class="vital-label">NIHSS:</span> <span class="vital-value">${vitalSigns.nihss}</span> <span style="font-size: 8px; color: #6b7280;">/42</span>`
                            : ""
                        }
                        ${
                          vitalSigns.fall_assessment
                            ? `<span class="vital-label">Fall Risk:</span> <span class="vital-value">${vitalSigns.fall_assessment}</span>`
                            : ""
                        }
                      </div>
                    `
                    : `<div style="color: #6b7280; font-size: 9px; margin-top: 2mm;">No vital signs recorded</div>`
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
      ? selectedTests
          .map((id) => {
            const test = tests.find((t) => String(t.value) === String(id));
            return test ? test.label : `Unknown Test ID ${id}`;
          })
          .join(", ") + "."
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
          followUpDate
            ? `
              <div class="follow-up-section">
                <div class="section-title">FOLLOW UP</div>
                <div style="display: flex; justify-content: space-between; gap: 5mm">
                  <div><strong>Date:</strong> ${new Date(
                    followUpDate
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}</div>
                  <div class="urdu-date">
                    <span>
                      برائے مہربانی 
                      <span style="color: #1e40af; font-weight: 500">
                        ${urduDate(followUpDate)}
                      </span>
                      کو دوبارہ تشریف لائیں
                    </span>
                  </div>
                  <div class="notes"><strong>Notes:</strong> ${
                    followUpNotes || "-"
                  }</div>
                </div>
              </div>
            `
            : ""
        }
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

export default printConsultation;