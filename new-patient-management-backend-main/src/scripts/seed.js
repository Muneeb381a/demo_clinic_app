// src/scripts/seed.js — Demo seed: run once on a fresh DB.
// Usage: node src/scripts/seed.js
// Safe to re-run (all inserts use ON CONFLICT DO NOTHING).

import dotenv from "dotenv";
dotenv.config();

import { pool } from "../models/db.js";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// ── Seed data ────────────────────────────────────────────────────────────────

const MEDICINES = [
  ["Paracetamol",        "Acetaminophen",                 "Tablet",    "500mg",     "پیراسیٹامول",         "گولی",         "500ملی گرام"],
  ["Ibuprofen",          "Ibuprofen",                     "Tablet",    "400mg",     "آئبوپروفن",           "گولی",         "400ملی گرام"],
  ["Amoxicillin",        "Amoxicillin",                   "Capsule",   "500mg",     "اموکسیسلن",           "کیپسول",       "500ملی گرام"],
  ["Cetirizine",         "Cetirizine HCl",                "Tablet",    "10mg",      "سیٹیریزین",           "گولی",         "10ملی گرام"],
  ["Metformin",          "Metformin HCl",                 "Tablet",    "500mg",     "میٹفارمن",            "گولی",         "500ملی گرام"],
  ["Amlodipine",         "Amlodipine Besylate",           "Tablet",    "5mg",       "ایملوڈپین",           "گولی",         "5ملی گرام"],
  ["Omeprazole",         "Omeprazole",                    "Capsule",   "20mg",      "اومیپرازول",          "کیپسول",       "20ملی گرام"],
  ["Ciprofloxacin",      "Ciprofloxacin HCl",             "Tablet",    "500mg",     "سیپروفلوکساسن",       "گولی",         "500ملی گرام"],
  ["Azithromycin",       "Azithromycin",                  "Tablet",    "500mg",     "ایزیتھرومائسن",       "گولی",         "500ملی گرام"],
  ["Metronidazole",      "Metronidazole",                 "Tablet",    "400mg",     "میٹرونیڈازول",        "گولی",         "400ملی گرام"],
  ["Ceftriaxone",        "Ceftriaxone Sodium",            "Injection", "1g",        "سیفٹریاکسون",         "انجیکشن",      "1گرام"],
  ["Salbutamol",         "Salbutamol Sulphate",           "Inhaler",   "100mcg",    "سالبیوٹامول",         "انہیلر",       "100مائیکروگرام"],
  ["Prednisolone",       "Prednisolone",                  "Tablet",    "5mg",       "پریڈنیسولون",         "گولی",         "5ملی گرام"],
  ["Losartan",           "Losartan Potassium",            "Tablet",    "50mg",      "لوسارٹن",             "گولی",         "50ملی گرام"],
  ["Atenolol",           "Atenolol",                      "Tablet",    "50mg",      "اٹینولول",            "گولی",         "50ملی گرام"],
  ["Lisinopril",         "Lisinopril",                    "Tablet",    "10mg",      "لیسینوپریل",          "گولی",         "10ملی گرام"],
  ["Pantoprazole",       "Pantoprazole Sodium",           "Tablet",    "40mg",      "پینٹوپرازول",         "گولی",         "40ملی گرام"],
  ["Domperidone",        "Domperidone",                   "Tablet",    "10mg",      "ڈومپیریڈون",          "گولی",         "10ملی گرام"],
  ["Ondansetron",        "Ondansetron HCl",               "Tablet",    "8mg",       "آنڈینسیٹرون",         "گولی",         "8ملی گرام"],
  ["Ferrous Sulfate",    "Ferrous Sulfate",               "Tablet",    "200mg",     "فیرس سلفیٹ",          "گولی",         "200ملی گرام"],
  ["Folic Acid",         "Folic Acid",                    "Tablet",    "5mg",       "فولک ایسڈ",           "گولی",         "5ملی گرام"],
  ["Loperamide",         "Loperamide HCl",                "Capsule",   "2mg",       "لوپیرامائیڈ",         "کیپسول",       "2ملی گرام"],
  ["Chloroquine",        "Chloroquine Phosphate",         "Tablet",    "250mg",     "کلوروکوئن",           "گولی",         "250ملی گرام"],
  ["ORS",                "Oral Rehydration Salts",        "Sachet",    "27.9g",     "او آر ایس",           "ساشے",         "27.9گرام"],
  ["Metoprolol",         "Metoprolol Tartrate",           "Tablet",    "50mg",      "میٹوپرولول",          "گولی",         "50ملی گرام"],
  ["Oseltamivir",        "Oseltamivir Phosphate",         "Capsule",   "75mg",      "اوسیلٹامویر",         "کیپسول",       "75ملی گرام"],
  ["Montelukast",        "Montelukast Sodium",            "Tablet",    "10mg",      "مونٹیلوکاسٹ",         "گولی",         "10ملی گرام"],
  ["Clarithromycin",     "Clarithromycin",                "Tablet",    "500mg",     "کلیریتھرومائسن",      "گولی",         "500ملی گرام"],
  ["Sumatriptan",        "Sumatriptan Succinate",         "Tablet",    "50mg",      "سیوماٹریپٹن",         "گولی",         "50ملی گرام"],
  ["Amitriptyline",      "Amitriptyline HCl",             "Tablet",    "25mg",      "امیٹریپٹیلین",        "گولی",         "25ملی گرام"],
  ["Propranolol",        "Propranolol HCl",               "Tablet",    "40mg",      "پروپرانولول",         "گولی",         "40ملی گرام"],
  ["Zinc",               "Zinc Sulfate",                  "Syrup",     "20mg/5mL",  "زنک",                 "شربت",         "20ملی گرام"],
  ["Permethrin",         "Permethrin",                    "Cream",     "5%",        "پرمیتھرن",            "کریم",         "5%"],
  ["Ivermectin",         "Ivermectin",                    "Tablet",    "6mg",       "ایوڑمیکٹن",           "گولی",         "6ملی گرام"],
  ["Loratadine",         "Loratadine",                    "Tablet",    "10mg",      "لوراٹاڈین",           "گولی",         "10ملی گرام"],
  ["Hydroxyzine",        "Hydroxyzine HCl",               "Tablet",    "25mg",      "ہائیڈروکسیزین",       "گولی",         "25ملی گرام"],
  ["Glibenclamide",      "Glibenclamide",                 "Tablet",    "5mg",       "گلائبینکلامائیڈ",     "گولی",         "5ملی گرام"],
  ["Sitagliptin",        "Sitagliptin Phosphate",         "Tablet",    "100mg",     "سیٹاگلپٹن",           "گولی",         "100ملی گرام"],
  ["Insulin",            "Human Insulin",                 "Injection", "100IU/mL",  "انسولین",             "انجیکشن",      "100 آئی یو"],
  ["Empagliflozin",      "Empagliflozin",                 "Tablet",    "10mg",      "ایمپاگلیفلوزن",       "گولی",         "10ملی گرام"],
  ["Levofloxacin",       "Levofloxacin",                  "Tablet",    "500mg",     "لیووفلوکساسن",        "گولی",         "500ملی گرام"],
  ["Artemether",         "Artemether/Lumefantrine",       "Tablet",    "20/120mg",  "آرٹیمیتھر",           "گولی",         "20/120ملی گرام"],
  ["Primaquine",         "Primaquine Phosphate",          "Tablet",    "15mg",      "پریماکوئن",           "گولی",         "15ملی گرام"],
  ["Quinine",            "Quinine Sulphate",              "Tablet",    "300mg",     "کوئنین",              "گولی",         "300ملی گرام"],
  ["Hydrochlorothiazide","Hydrochlorothiazide",           "Tablet",    "25mg",      "ہائیڈروکلوروتھیازائیڈ","گولی",        "25ملی گرام"],
  ["Trimethoprim",       "Trimethoprim",                  "Tablet",    "200mg",     "ٹرائمیتھوپریم",       "گولی",         "200ملی گرام"],
  ["Nitrofurantoin",     "Nitrofurantoin",                "Capsule",   "100mg",     "نائٹروفیورینٹوئن",    "کیپسول",       "100ملی گرام"],
  ["Budesonide",         "Budesonide",                    "Inhaler",   "200mcg",    "بیوڈیسونائیڈ",        "انہیلر",       "200مائیکروگرام"],
  ["Ipratropium",        "Ipratropium Bromide",           "Inhaler",   "20mcg",     "آئپراٹروپیم",         "انہیلر",       "20مائیکروگرام"],
  ["Metoclopramide",     "Metoclopramide HCl",            "Tablet",    "10mg",      "میٹوکلوپرامائیڈ",     "گولی",         "10ملی گرام"],
  ["Ferrous Fumarate",   "Ferrous Fumarate",              "Tablet",    "200mg",     "فیرس فیومریٹ",        "گولی",         "200ملی گرام"],
  ["Vitamin C",          "Ascorbic Acid",                 "Tablet",    "500mg",     "وٹامن سی",            "گولی",         "500ملی گرام"],
  ["Ranitidine",         "Ranitidine HCl",                "Tablet",    "150mg",     "ریناٹیڈین",           "گولی",         "150ملی گرام"],
  ["Antacid",            "Aluminium/Magnesium Hydroxide", "Suspension","200/200mg", "اینٹیسڈ",             "معطل محلول",   "200ملی گرام"],
];

const SYMPTOMS = [
  "Fever", "Cough", "Headache", "Fatigue", "Body Ache", "Runny Nose",
  "Nasal Congestion", "Sore Throat", "Sneezing", "Chills", "Sweating",
  "Loss of Appetite", "Nausea", "Vomiting", "Diarrhea", "Constipation",
  "Abdominal Pain", "Abdominal Cramps", "Bloating", "Heartburn", "Burning Stomach",
  "Chest Pain", "Shortness of Breath", "Wheezing", "Chest Tightness",
  "Dizziness", "Blurred Vision", "Nosebleed", "Weakness",
  "Painful Urination", "Frequent Urination", "Burning Urination",
  "Lower Abdominal Pain", "Cloudy Urine", "Back Pain",
  "Excessive Thirst", "Weight Loss", "Slow Healing Wounds", "Numbness in Hands",
  "Pallor", "Cold Hands", "Brittle Nails",
  "Rash", "Itching", "Hives", "Swelling", "Redness",
  "Skin Burrows", "Night Itching",
  "Joint Pain", "Eye Pain", "Severe Headache", "Bleeding Gums",
  "Difficulty Swallowing", "Swollen Tonsils", "Bad Breath",
  "Sensitivity to Light", "Sensitivity to Sound",
];

const TESTS = [
  ["CBC",                    "Complete Blood Count"],
  ["CRP",                    "C-Reactive Protein"],
  ["ESR",                    "Erythrocyte Sedimentation Rate"],
  ["Chest X-Ray",            null],
  ["ECG",                    "Electrocardiogram"],
  ["Urine R/E",              "Urine Routine Examination"],
  ["Urine Culture",          null],
  ["Urine CS",               "Culture & Sensitivity"],
  ["Stool R/E",              "Stool Routine Examination"],
  ["Stool Culture",          null],
  ["Blood Sugar Fasting",    null],
  ["Blood Sugar Random",     null],
  ["HbA1c",                  "Glycated Haemoglobin"],
  ["Lipid Profile",          null],
  ["Liver Function Tests",   "LFTs"],
  ["Renal Function Tests",   "RFTs / Kidney Function Tests"],
  ["Thyroid Function Tests", "TFTs"],
  ["Serum Ferritin",         null],
  ["Serum Iron",             null],
  ["TIBC",                   "Total Iron Binding Capacity"],
  ["Peripheral Smear",       null],
  ["Blood Culture",          null],
  ["Sputum Culture",         null],
  ["Throat Culture",         null],
  ["Electrolytes",           "Na, K, Cl"],
  ["Coagulation Profile",    "PT, APTT, INR"],
  ["Procalcitonin",          null],
  ["Typhoid Test (Widal)",   null],
  ["Typhoid Rapid Test",     null],
  ["Malaria RDT",            "Malaria Rapid Diagnostic Test"],
  ["Malaria Blood Smear",    null],
  ["Dengue NS1",             null],
  ["Dengue IgM/IgG",         null],
  ["Platelet Count",         null],
  ["H. Pylori Test",         "Helicobacter Pylori"],
  ["Stool Occult Blood",     null],
  ["Endoscopy",              "Upper GI Endoscopy"],
  ["CT Brain",               null],
  ["MRI Brain",              null],
  ["Peak Flow Rate",         null],
  ["Spirometry",             null],
  ["Allergy Panel",          null],
  ["IgE Level",              null],
  ["Renal Ultrasound",       null],
  ["Echo",                   "Echocardiogram"],
  ["Fundoscopy",             "Ophthalmoscopy"],
  ["Blood Pressure",         "BP Monitoring"],
  ["Influenza Rapid Test",   null],
  ["Skin Scraping",          null],
  ["Kidney Function Tests",  null],
];

const PATIENTS = [
  { name: "Muhammad Ahmed",   age: 45, gender: "male",   mobile: "03001234567", weight: 72, height: 170 },
  { name: "Fatima Bibi",      age: 32, gender: "female", mobile: "03002345678", weight: 58, height: 158 },
  { name: "Ali Hassan",       age: 28, gender: "male",   mobile: "03003456789", weight: 68, height: 175 },
  { name: "Ayesha Khan",      age: 55, gender: "female", mobile: "03004567890", weight: 65, height: 162 },
  { name: "Usman Malik",      age: 67, gender: "male",   mobile: "03005678901", weight: 80, height: 168 },
  { name: "Sara Iqbal",       age: 22, gender: "female", mobile: "03006789012", weight: 52, height: 155 },
  { name: "Tariq Mehmood",    age: 41, gender: "male",   mobile: "03007890123", weight: 76, height: 172 },
  { name: "Zainab Hussain",   age: 38, gender: "female", mobile: "03008901234", weight: 60, height: 160 },
  { name: "Imran Butt",       age: 52, gender: "male",   mobile: "03009012345", weight: 85, height: 174 },
  { name: "Nadia Rasheed",    age: 29, gender: "female", mobile: "03000123456", weight: 55, height: 163 },
];

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedMedicines(client) {
  const placeholders = MEDICINES.map(
    (_, i) => `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6},$${i * 7 + 7})`
  ).join(",");
  await client.query(
    `INSERT INTO medicines (brand_name, generic_name, form, strength, urdu_name, urdu_form, urdu_strength)
     VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    MEDICINES.flat()
  );
  console.log(`  ✓ ${MEDICINES.length} medicines`);
}

async function seedSymptoms(client) {
  const placeholders = SYMPTOMS.map((_, i) => `($${i + 1})`).join(",");
  await client.query(
    `INSERT INTO symptoms (name) VALUES ${placeholders} ON CONFLICT (name) DO NOTHING`,
    SYMPTOMS
  );
  console.log(`  ✓ ${SYMPTOMS.length} symptoms`);
}

async function seedTests(client) {
  const placeholders = TESTS.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(",");
  await client.query(
    `INSERT INTO tests (test_name, test_notes) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    TESTS.flat()
  );
  console.log(`  ✓ ${TESTS.length} tests`);
}

async function seedDemoDoctor(client) {
  const hash = await bcrypt.hash("demo1234", 12);
  await client.query(
    `INSERT INTO auth_users (name, email, password_hash, salt, role, specialization)
     VALUES ($1,$2,$3,'',$4,$5) ON CONFLICT (email) DO NOTHING`,
    ["Dr. Abdul Rauf", "demo@clinic.com", hash, "doctor", "Neurology"]
  );
  console.log("  ✓ Demo doctor  →  email: demo@clinic.com  |  password: demo1234");
}

async function seedPatients(client) {
  const rows = [];
  for (const p of PATIENTS) {
    const mr_no = `MR-${uuidv4()}`;
    const r = await client.query(
      `INSERT INTO patients (mobile, mr_no, name, age, gender, weight, height, checkup_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE - (RANDOM()*60)::int)
       ON CONFLICT DO NOTHING RETURNING id`,
      [p.mobile, mr_no, p.name, p.age, p.gender, p.weight, p.height]
    );
    if (r.rows.length) rows.push({ id: r.rows[0].id, ...p });
  }
  console.log(`  ✓ ${rows.length} patients`);
  return rows;
}

async function seedConsultations(client, patients) {
  // Look up a few symptom and medicine IDs for realistic data
  const { rows: symRows } = await client.query(
    `SELECT id, name FROM symptoms WHERE name = ANY($1::text[]) ORDER BY id`,
    [["Fever", "Headache", "Cough", "Fatigue", "Nausea", "Dizziness", "Body Ache", "Shortness of Breath"]]
  );
  const { rows: medRows } = await client.query(
    `SELECT id, brand_name FROM medicines WHERE brand_name = ANY($1::text[]) ORDER BY id`,
    [["Paracetamol", "Ibuprofen", "Amoxicillin", "Cetirizine", "Omeprazole", "Metformin", "Amlodipine"]]
  );
  const { rows: testRows } = await client.query(
    `SELECT id, test_name FROM tests WHERE test_name = ANY($1::text[]) ORDER BY id`,
    [["CBC", "CRP", "Urine R/E", "Blood Sugar Fasting", "Chest X-Ray", "ECG"]]
  );

  if (!symRows.length || !medRows.length) {
    console.log("  ⚠ Skipping consultations — symptom/medicine seed data missing");
    return;
  }

  const doctor = "Dr. Abdul Rauf";
  let count = 0;

  for (const patient of patients.slice(0, 8)) {
    // 2 consultations per patient (recent dates)
    for (let c = 0; c < 2; c++) {
      const daysAgo = c === 0 ? Math.floor(Math.random() * 7) : Math.floor(Math.random() * 60) + 15;
      const visitDate = new Date(Date.now() - daysAgo * 86400000).toISOString();

      // 1. Consultation
      const { rows: [cons] } = await client.query(
        `INSERT INTO consultations (patient_id, doctor_name, visit_date) VALUES ($1,$2,$3) RETURNING id`,
        [patient.id, doctor, visitDate]
      );
      const cId = cons.id;

      // 2. Vitals
      await client.query(
        `INSERT INTO vital_signs (consultation_id, patient_id, pulse_rate, blood_pressure, temperature, spo2_level)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [cId, patient.id,
          `${70 + Math.floor(Math.random() * 30)}`,
          `${110 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 15)}`,
          `${36 + (Math.random() * 2).toFixed(1)}`,
          `${95 + Math.floor(Math.random() * 5)}`]
      );

      // 3. Symptoms (2–3 random)
      const pickedSyms = symRows.sort(() => 0.5 - Math.random()).slice(0, 3);
      for (const s of pickedSyms) {
        await client.query(
          `INSERT INTO consultation_symptoms (consultation_id, symptom_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [cId, s.id]
        );
      }

      // 4. Prescriptions (1–2 medicines)
      const pickedMeds = medRows.sort(() => 0.5 - Math.random()).slice(0, 2);
      for (const m of pickedMeds) {
        await client.query(
          `INSERT INTO prescriptions
             (consultation_id, patient_id, medicine_id,
              dosage_en, dosage_urdu, frequency_en, frequency_urdu,
              duration_en, duration_urdu, instructions_en, instructions_urdu, prescribed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
          [cId, patient.id, m.id,
           "1 tablet", "1 گولی", "twice daily", "دن میں دو بار",
           "7 days", "7 دن", "after meal", "کھانے کے بعد"]
        );
      }

      // 5. Tests (1 test)
      if (testRows.length) {
        const t = testRows[Math.floor(Math.random() * testRows.length)];
        await client.query(
          `INSERT INTO consultation_tests (consultation_id, test_id, assigned_at)
           VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING`,
          [cId, t.id]
        );
      }

      // 6. Follow-up for first consultation only
      if (c === 0) {
        const followDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
        await client.query(
          `INSERT INTO follow_ups (consultation_id, follow_up_date, notes) VALUES ($1,$2,$3)`,
          [cId, followDate, "عام چیک اپ"]
        );
      }

      count++;
    }
  }
  console.log(`  ✓ ${count} consultations (with vitals, symptoms, prescriptions, tests, follow-ups)`);
}

async function seedNeuroOptions(client) {
  const neuroData = {
    motor_function_options: [
      "Normal","Mild Weakness","Moderate Weakness","Severe Weakness",
      "Plegia","Hemiplegia","Paraplegia","Monoplegia","Quadriplegia",
      "Hyperkinesia","Hypokinesia","Spastic Weakness","Flaccid Weakness",
    ],
    muscle_tone_options: [
      "Normal","Hypertonia","Hypotonia","Spasticity","Rigidity",
      "Flaccidity","Clasp-knife Rigidity","Lead-pipe Rigidity",
      "Cogwheel Rigidity","Decerebrate Rigidity","Decorticate Rigidity",
    ],
    muscle_strength_options: [
      "5/5 - Normal","4/5 - Active movement against some resistance",
      "3/5 - Active movement against gravity","2/5 - Active movement with gravity eliminated",
      "1/5 - Trace contraction","0/5 - No contraction",
      "4+/5","4-/5","3+/5","Symmetrical","Asymmetrical",
    ],
    deep_tendon_reflexes_options: [
      "Normal (2+)","Absent (0)","Diminished (1+)","Brisk (3+)","Clonus (4+)",
      "Hyperreflexia","Hyporeflexia","Areflexia","Symmetrical","Asymmetrical",
      "Biceps Normal","Triceps Normal","Knee Jerk Normal","Ankle Jerk Normal",
      "Biceps Absent","Knee Jerk Absent","Ankle Jerk Absent",
    ],
    plantar_reflex_options: [
      "Flexor (Normal)","Extensor (Babinski Positive)","Equivocal","Absent",
      "Bilateral Flexor","Bilateral Extensor","Right Extensor","Left Extensor","Withdrawal Response",
    ],
    pupillary_reaction_options: [
      "Equal and Reactive","Unequal","Fixed and Dilated","Fixed and Constricted",
      "Sluggish Reaction","RAPD (Relative Afferent Pupillary Defect)",
      "Miosis","Mydriasis","Anisocoria","Brisk Reaction","No Reaction","Left Sluggish","Right Sluggish",
    ],
    speech_assessment_options: [
      "Normal","Dysarthria","Aphasia","Expressive Aphasia","Receptive Aphasia",
      "Mixed Aphasia","Dysphonia","Slurred Speech","Scanning Speech","Monotone Speech",
      "Apraxia of Speech","Stuttering","Mute","Hoarse Voice",
    ],
    gait_assessment_options: [
      "Normal","Ataxic Gait","Hemiplegic Gait","Spastic Gait","Steppage Gait",
      "Antalgic Gait","Trendelenburg Gait","Scissor Gait","Parkinsonian Gait (Festinating)",
      "Waddling Gait","Magnetic Gait","Unable to Walk","Wide-based Gait","Cautious Gait",
    ],
    coordination_options: [
      "Normal","Dysmetria","Past-pointing","Dysdiadochokinesia","Intention Tremor","Ataxia",
      "Cerebellar Ataxia","Sensory Ataxia","Mild Incoordination","Severe Incoordination",
      "Heel-shin Inaccurate","Finger-nose Inaccurate","Finger-nose Normal","Heel-shin Normal",
    ],
    sensory_examination_options: [
      "Normal","Reduced Sensation","Absent Sensation","Hyperesthesia","Paresthesia","Numbness",
      "Pain Sensation Reduced","Vibration Reduced","Proprioception Impaired","Dermatomal Pattern",
      "Glove and Stocking Pattern","Hemibody Loss","Normal Bilaterally",
    ],
    cranial_nerves_options: [
      "Intact","I - Olfactory Intact","II - Visual Acuity Normal","III - Oculomotor Normal",
      "IV - Trochlear Normal","V - Trigeminal Normal","VI - Abducens Normal","VII - Facial Normal",
      "VIII - Auditory Normal","IX - Glossopharyngeal Normal","X - Vagus Normal",
      "XI - Accessory Normal","XII - Hypoglossal Normal",
      "III Palsy","VI Palsy","VII Palsy","Multiple Cranial Nerve Palsy","All Cranial Nerves Intact",
    ],
    mental_status_options: [
      "Alert and Oriented","Confused","Disoriented to Time","Disoriented to Place",
      "Disoriented to Person","Drowsy","Stuporous","Comatose","Agitated","Anxious",
      "Depressed Affect","Flat Affect","Oriented x3","Oriented x2","Memory Impaired","Intact","Delirium",
    ],
    cerebellar_function_options: [
      "Normal","Impaired","Dysmetria Present","Dysdiadochokinesia Present","Intention Tremor Present",
      "Nystagmus Present","Tandem Walking Impaired","Romberg Positive","Romberg Negative","Ataxia",
      "Finger-nose Inaccurate","Heel-shin Inaccurate","All Normal",
    ],
    muscle_wasting_options: [
      "None","Mild","Moderate","Severe","Global Wasting","Focal Wasting",
      "Thenar Wasting","Hypothenar Wasting","Distal Wasting","Proximal Wasting",
      "Bilateral","Unilateral","Symmetrical","Asymmetrical",
    ],
    abnormal_movements_options: [
      "None","Tremor","Resting Tremor","Intention Tremor","Postural Tremor","Chorea","Athetosis",
      "Ballismus","Hemiballismus","Myoclonus","Tics","Dystonia","Fasciculations","Clonus","Spasms",
    ],
    romberg_test_options: [
      "Negative (Normal)","Positive","Unable to Assess","Not Tested",
      "Positive with Eyes Open","Positive with Eyes Closed only",
      "Mild Sway","Significant Sway","Falls without support",
    ],
    nystagmus_options: [
      "Absent","Present","Horizontal Nystagmus","Vertical Nystagmus","Rotatory Nystagmus",
      "Gaze-evoked Nystagmus","Downbeat Nystagmus","Upbeat Nystagmus","Pendular Nystagmus",
      "Bidirectional","Unidirectional","Bilateral",
    ],
    fundoscopy_options: [
      "Normal","Papilledema","Optic Atrophy","Hypertensive Retinopathy","Diabetic Retinopathy",
      "AV Nipping","Flame Hemorrhages","Disc Pallor","Cup-Disc Ratio Increased","Normal Disc",
      "Cotton Wool Spots","Drusen","Not Performed",
    ],
    straight_leg_raise_left_options: [
      "Negative","Positive at 30°","Positive at 45°","Positive at 60°","Positive at 70°",
      "Positive at 90°","Positive (angle not documented)","Unable to Assess","Not Tested",
    ],
    straight_leg_raise_right_options: [
      "Negative","Positive at 30°","Positive at 45°","Positive at 60°","Positive at 70°",
      "Positive at 90°","Positive (angle not documented)","Unable to Assess","Not Tested",
    ],
  };

  let total = 0;
  for (const [table, values] of Object.entries(neuroData)) {
    const ph = values.map((_, i) => `($${i + 1})`).join(",");
    await client.query(
      `INSERT INTO ${table} (value) VALUES ${ph} ON CONFLICT DO NOTHING`,
      values
    );
    total += values.length;
  }
  console.log(`  ✓ ${total} neuro option values (20 tables)`);
}

async function seedDiseaseGraph(client) {
  // Run migration 003 inline — uses subqueries by name so it adapts to real IDs
  await client.query(`
    INSERT INTO diseases (name, icd10_code, category, description) VALUES
      ('Upper Respiratory Tract Infection','J06.9','Respiratory','Common cold, pharyngitis, rhinitis'),
      ('Influenza','J11.1','Respiratory','Seasonal flu'),
      ('Pneumonia','J18.9','Respiratory','Lung infection'),
      ('Asthma','J45.9','Respiratory','Chronic airway inflammation'),
      ('Urinary Tract Infection','N39.0','Urological','Bacterial infection of urinary system'),
      ('Hypertension','I10','Cardiovascular','Persistently elevated blood pressure'),
      ('Type 2 Diabetes','E11','Endocrine','Insulin resistance with hyperglycemia'),
      ('Acute Gastroenteritis','A09','Gastrointestinal','Inflammation of stomach and intestines'),
      ('Peptic Ulcer Disease','K27.9','Gastrointestinal','Ulceration of stomach or duodenal lining'),
      ('Migraine','G43.9','Neurological','Recurring severe unilateral headache'),
      ('Iron Deficiency Anemia','D50','Hematological','Low hemoglobin due to iron deficiency'),
      ('Typhoid Fever','A01.0','Infectious','Salmonella typhi systemic infection'),
      ('Malaria','B54','Infectious','Plasmodium parasite infection'),
      ('Dengue Fever','A90','Infectious','Dengue virus infection'),
      ('Skin Allergy / Urticaria','L50.9','Dermatological','Allergic skin reaction with hives'),
      ('Acute Tonsillitis','J03.9','ENT','Bacterial or viral tonsil inflammation')
    ON CONFLICT (name) DO NOTHING
  `);

  // Disease → Symptom mappings (representative subset — full data in migration 003)
  await client.query(`
    INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
    SELECT d.id, s.id, v.weight
    FROM diseases d
    JOIN (VALUES
      ('Upper Respiratory Tract Infection','Runny Nose',0.9),
      ('Upper Respiratory Tract Infection','Cough',0.75),
      ('Upper Respiratory Tract Infection','Sore Throat',0.8),
      ('Upper Respiratory Tract Infection','Fever',0.6),
      ('Upper Respiratory Tract Infection','Headache',0.5),
      ('Influenza','Fever',0.9),
      ('Influenza','Body Ache',0.9),
      ('Influenza','Fatigue',0.85),
      ('Influenza','Headache',0.8),
      ('Influenza','Cough',0.7),
      ('Pneumonia','Fever',0.9),
      ('Pneumonia','Cough',0.9),
      ('Pneumonia','Chest Pain',0.8),
      ('Pneumonia','Shortness of Breath',0.85),
      ('Asthma','Wheezing',1.0),
      ('Asthma','Shortness of Breath',0.9),
      ('Asthma','Cough',0.8),
      ('Asthma','Chest Tightness',0.85),
      ('Hypertension','Headache',0.7),
      ('Hypertension','Dizziness',0.65),
      ('Type 2 Diabetes','Frequent Urination',0.9),
      ('Type 2 Diabetes','Excessive Thirst',0.9),
      ('Type 2 Diabetes','Fatigue',0.7),
      ('Acute Gastroenteritis','Diarrhea',1.0),
      ('Acute Gastroenteritis','Nausea',0.85),
      ('Acute Gastroenteritis','Vomiting',0.85),
      ('Acute Gastroenteritis','Abdominal Pain',0.8),
      ('Migraine','Headache',1.0),
      ('Migraine','Nausea',0.8),
      ('Migraine','Sensitivity to Light',0.85),
      ('Dengue Fever','Fever',1.0),
      ('Dengue Fever','Severe Headache',0.9),
      ('Dengue Fever','Joint Pain',0.9),
      ('Dengue Fever','Body Ache',0.85)
    ) AS v(disease_name, symptom_name, weight) ON true
    JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
    WHERE d.name = v.disease_name
    ON CONFLICT DO NOTHING
  `);

  // Disease → Medicine mappings
  await client.query(`
    INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
    SELECT d.id, m.id, v.rank, v.first_line, 0
    FROM diseases d
    JOIN (VALUES
      ('Upper Respiratory Tract Infection','Paracetamol',1,true),
      ('Upper Respiratory Tract Infection','Ibuprofen',2,false),
      ('Upper Respiratory Tract Infection','Cetirizine',2,false),
      ('Influenza','Paracetamol',1,true),
      ('Influenza','Oseltamivir',1,true),
      ('Pneumonia','Amoxicillin',1,true),
      ('Pneumonia','Azithromycin',1,true),
      ('Pneumonia','Ceftriaxone',2,false),
      ('Asthma','Salbutamol',1,true),
      ('Asthma','Budesonide',1,true),
      ('Asthma','Montelukast',2,false),
      ('Hypertension','Amlodipine',1,true),
      ('Hypertension','Lisinopril',1,true),
      ('Hypertension','Losartan',1,true),
      ('Type 2 Diabetes','Metformin',1,true),
      ('Type 2 Diabetes','Glibenclamide',2,false),
      ('Acute Gastroenteritis','ORS',1,true),
      ('Acute Gastroenteritis','Metronidazole',1,true),
      ('Acute Gastroenteritis','Ondansetron',3,false),
      ('Peptic Ulcer Disease','Omeprazole',1,true),
      ('Peptic Ulcer Disease','Pantoprazole',1,true),
      ('Migraine','Sumatriptan',1,true),
      ('Migraine','Ibuprofen',1,true),
      ('Dengue Fever','Paracetamol',1,true),
      ('Dengue Fever','ORS',1,true)
    ) AS v(disease_name, med_name, rank, first_line) ON true
    JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
    WHERE d.name = v.disease_name
    ON CONFLICT DO NOTHING
  `);

  // Disease → Test mappings
  await client.query(`
    INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
    SELECT d.id, t.id, v.rank, v.essential, 0
    FROM diseases d
    JOIN (VALUES
      ('Upper Respiratory Tract Infection','CBC',1,false),
      ('Upper Respiratory Tract Infection','CRP',2,false),
      ('Influenza','CBC',1,true),
      ('Influenza','Chest X-Ray',3,false),
      ('Pneumonia','Chest X-Ray',1,true),
      ('Pneumonia','CBC',1,true),
      ('Pneumonia','CRP',2,false),
      ('Asthma','Peak Flow Rate',1,true),
      ('Asthma','Spirometry',1,true),
      ('Hypertension','ECG',1,true),
      ('Hypertension','Renal Function Tests',1,true),
      ('Hypertension','Lipid Profile',2,false),
      ('Type 2 Diabetes','Blood Sugar Fasting',1,true),
      ('Type 2 Diabetes','HbA1c',1,true),
      ('Type 2 Diabetes','Lipid Profile',2,false),
      ('Acute Gastroenteritis','Stool R/E',1,true),
      ('Acute Gastroenteritis','CBC',1,false),
      ('Migraine','CBC',1,false),
      ('Migraine','CT Brain',2,false),
      ('Dengue Fever','Dengue NS1',1,true),
      ('Dengue Fever','Dengue IgM/IgG',1,true),
      ('Dengue Fever','Platelet Count',1,true),
      ('Dengue Fever','CBC',1,true)
    ) AS v(disease_name, test_name, rank, essential) ON true
    JOIN tests t ON lower(t.test_name) = lower(v.test_name)
    WHERE d.name = v.disease_name
    ON CONFLICT DO NOTHING
  `);

  console.log("  ✓ Disease knowledge graph (diseases, symptom/medicine/test mappings)");
}

async function createDbObjects(client) {
  // Auto-update updated_at trigger (from migration 001)
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql
  `);
  await client.query(`
    DROP TRIGGER IF EXISTS set_auth_users_updated_at ON auth_users
  `);
  await client.query(`
    CREATE TRIGGER set_auth_users_updated_at
    BEFORE UPDATE ON auth_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `);

  // Feedback frequency updater (from migration 002)
  await client.query(`
    CREATE OR REPLACE FUNCTION process_suggestion_feedback()
    RETURNS INTEGER AS $$
    DECLARE
      rec    suggestion_feedback%ROWTYPE;
      cnt    INTEGER := 0;
      med_id INTEGER;
      tst_id INTEGER;
      dis_id INTEGER;
    BEGIN
      FOR rec IN SELECT * FROM suggestion_feedback WHERE processed = false ORDER BY created_at ASC LOOP
        IF rec.suggested_disease_ids IS NOT NULL AND array_length(rec.accepted_medicine_ids,1) > 0 THEN
          FOREACH dis_id IN ARRAY rec.suggested_disease_ids LOOP
            FOREACH med_id IN ARRAY rec.accepted_medicine_ids LOOP
              UPDATE disease_medicines SET frequency = frequency + 1
              WHERE disease_id = dis_id AND medicine_id = med_id;
            END LOOP;
          END LOOP;
        END IF;
        IF rec.suggested_disease_ids IS NOT NULL AND array_length(rec.accepted_test_ids,1) > 0 THEN
          FOREACH dis_id IN ARRAY rec.suggested_disease_ids LOOP
            FOREACH tst_id IN ARRAY rec.accepted_test_ids LOOP
              UPDATE disease_tests SET frequency = frequency + 1
              WHERE disease_id = dis_id AND test_id = tst_id;
            END LOOP;
          END LOOP;
        END IF;
        UPDATE suggestion_feedback SET processed = true WHERE id = rec.id;
        cnt := cnt + 1;
      END LOOP;
      RETURN cnt;
    END;
    $$ LANGUAGE plpgsql
  `);

  console.log("  ✓ DB functions & triggers");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱 Seeding database...\n");
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

    await seedMedicines(client);
    await seedSymptoms(client);
    await seedTests(client);
    await seedDemoDoctor(client);
    const patients = await seedPatients(client);
    await seedConsultations(client, patients);
    await seedNeuroOptions(client);
    await seedDiseaseGraph(client);
    await createDbObjects(client);

    console.log("\n✅ Seed complete.\n");
  } catch (err) {
    console.error("\n❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
