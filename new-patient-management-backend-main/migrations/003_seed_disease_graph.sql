-- =============================================================================
-- Migration 003: Disease Graph Seed Data
-- =============================================================================
-- Populates the knowledge graph tables using subqueries by name so the data
-- works regardless of your actual auto-increment IDs.
-- Rows are skipped silently (ON CONFLICT DO NOTHING) if a name doesn't exist
-- in your symptoms/medicines/tests tables yet.
--
-- Run AFTER 002_smart_prescription_schema.sql.
-- Safe to re-run (idempotent).
-- =============================================================================

-- Ensure trigram extension is active (safe no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- DISEASES
-- =============================================================================
INSERT INTO diseases (name, icd10_code, category, description) VALUES
  ('Upper Respiratory Tract Infection', 'J06.9',  'Respiratory',     'Common cold, pharyngitis, rhinitis'),
  ('Influenza',                          'J11.1',  'Respiratory',     'Seasonal flu caused by influenza virus'),
  ('Pneumonia',                          'J18.9',  'Respiratory',     'Lung infection, bacterial or viral'),
  ('Asthma',                             'J45.9',  'Respiratory',     'Chronic airway inflammation with bronchospasm'),
  ('Urinary Tract Infection',            'N39.0',  'Urological',      'Bacterial infection of the urinary system'),
  ('Hypertension',                       'I10',    'Cardiovascular',  'Persistently elevated blood pressure'),
  ('Type 2 Diabetes',                    'E11',    'Endocrine',       'Insulin resistance with hyperglycemia'),
  ('Acute Gastroenteritis',              'A09',    'Gastrointestinal','Inflammation of stomach and intestines'),
  ('Peptic Ulcer Disease',               'K27.9',  'Gastrointestinal','Ulceration of stomach or duodenal lining'),
  ('Migraine',                           'G43.9',  'Neurological',    'Recurring severe unilateral headache'),
  ('Iron Deficiency Anemia',             'D50',    'Hematological',   'Low hemoglobin due to iron deficiency'),
  ('Typhoid Fever',                      'A01.0',  'Infectious',      'Salmonella typhi systemic infection'),
  ('Malaria',                            'B54',    'Infectious',      'Plasmodium parasite infection via mosquito'),
  ('Dengue Fever',                       'A90',    'Infectious',      'Dengue virus infection via Aedes mosquito'),
  ('Scabies',                            'B86',    'Dermatological',  'Sarcoptes scabiei mite skin infestation'),
  ('Hepatitis B',                        'B18.1',  'Hepatic',         'Chronic HBV liver infection'),
  ('Hepatitis C',                        'B18.2',  'Hepatic',         'Chronic HCV liver infection'),
  ('Pulmonary Tuberculosis',             'A15.0',  'Respiratory',     'Mycobacterium tuberculosis lung infection'),
  ('Skin Allergy / Urticaria',           'L50.9',  'Dermatological',  'Allergic skin reaction with hives'),
  ('Anxiety Disorder',                   'F41.9',  'Psychiatric',     'Excessive, persistent worry and fear'),
  ('Depression',                         'F32.9',  'Psychiatric',     'Persistent low mood and loss of interest'),
  ('Osteoarthritis',                     'M19.9',  'Musculoskeletal', 'Degenerative joint disease'),
  ('Rheumatoid Arthritis',               'M05.9',  'Musculoskeletal', 'Autoimmune inflammatory joint disease'),
  ('Acute Tonsillitis',                  'J03.9',  'ENT',             'Bacterial or viral tonsil inflammation'),
  ('Otitis Media',                       'H66.9',  'ENT',             'Middle ear infection')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- DISEASE → SYMPTOM MAPPINGS
-- Weight scale: 1.0=pathognomonic, 0.7=highly associated, 0.5=moderate, 0.3=weak
-- Uses subqueries so it works with any real symptom IDs.
-- =============================================================================

-- ── Upper Respiratory Tract Infection ──────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Runny Nose',        0.9),
  ('Nasal Congestion',  0.85),
  ('Sore Throat',       0.8),
  ('Cough',             0.75),
  ('Sneezing',          0.8),
  ('Fever',             0.6),
  ('Headache',          0.5),
  ('Fatigue',           0.5),
  ('Body Ache',         0.4)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Upper Respiratory Tract Infection'
ON CONFLICT DO NOTHING;

-- ── Influenza ───────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Fever',             0.9),
  ('Body Ache',         0.9),
  ('Fatigue',           0.85),
  ('Headache',          0.8),
  ('Cough',             0.7),
  ('Chills',            0.8),
  ('Sore Throat',       0.5),
  ('Runny Nose',        0.4),
  ('Loss of Appetite',  0.5)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Influenza'
ON CONFLICT DO NOTHING;

-- ── Pneumonia ───────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Fever',             0.9),
  ('Cough',             0.9),
  ('Chest Pain',        0.8),
  ('Shortness of Breath', 0.85),
  ('Fatigue',           0.7),
  ('Chills',            0.7),
  ('Body Ache',         0.5),
  ('Loss of Appetite',  0.5)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Pneumonia'
ON CONFLICT DO NOTHING;

-- ── Asthma ──────────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Wheezing',          1.0),
  ('Shortness of Breath', 0.9),
  ('Cough',             0.8),
  ('Chest Tightness',   0.85),
  ('Fatigue',           0.4)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Asthma'
ON CONFLICT DO NOTHING;

-- ── Urinary Tract Infection ─────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Painful Urination', 1.0),
  ('Frequent Urination',0.9),
  ('Burning Urination', 0.95),
  ('Lower Abdominal Pain', 0.7),
  ('Fever',             0.5),
  ('Cloudy Urine',      0.8),
  ('Back Pain',         0.4),
  ('Fatigue',           0.3)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Urinary Tract Infection'
ON CONFLICT DO NOTHING;

-- ── Hypertension ────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Headache',          0.7),
  ('Dizziness',         0.65),
  ('Blurred Vision',    0.6),
  ('Chest Pain',        0.5),
  ('Shortness of Breath', 0.4),
  ('Fatigue',           0.4),
  ('Nosebleed',         0.4)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Hypertension'
ON CONFLICT DO NOTHING;

-- ── Type 2 Diabetes ─────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Frequent Urination',0.9),
  ('Excessive Thirst',  0.9),
  ('Fatigue',           0.7),
  ('Blurred Vision',    0.65),
  ('Slow Healing Wounds', 0.7),
  ('Weight Loss',       0.6),
  ('Numbness in Hands', 0.5),
  ('Dizziness',         0.4)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Type 2 Diabetes'
ON CONFLICT DO NOTHING;

-- ── Acute Gastroenteritis ───────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Diarrhea',          1.0),
  ('Nausea',            0.85),
  ('Vomiting',          0.85),
  ('Abdominal Pain',    0.8),
  ('Abdominal Cramps',  0.8),
  ('Fever',             0.6),
  ('Loss of Appetite',  0.6),
  ('Fatigue',           0.5),
  ('Weakness',          0.5)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Acute Gastroenteritis'
ON CONFLICT DO NOTHING;

-- ── Peptic Ulcer Disease ────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Abdominal Pain',    0.9),
  ('Burning Stomach',   0.95),
  ('Nausea',            0.7),
  ('Loss of Appetite',  0.65),
  ('Bloating',          0.6),
  ('Vomiting',          0.4),
  ('Heartburn',         0.7),
  ('Weight Loss',       0.3)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Peptic Ulcer Disease'
ON CONFLICT DO NOTHING;

-- ── Migraine ────────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Headache',          1.0),
  ('Nausea',            0.8),
  ('Vomiting',          0.7),
  ('Sensitivity to Light', 0.85),
  ('Sensitivity to Sound', 0.8),
  ('Dizziness',         0.6),
  ('Blurred Vision',    0.5),
  ('Fatigue',           0.4)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Migraine'
ON CONFLICT DO NOTHING;

-- ── Iron Deficiency Anemia ──────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Fatigue',           0.9),
  ('Weakness',          0.85),
  ('Dizziness',         0.7),
  ('Pallor',            0.85),
  ('Shortness of Breath', 0.65),
  ('Headache',          0.5),
  ('Cold Hands',        0.5),
  ('Brittle Nails',     0.6)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Iron Deficiency Anemia'
ON CONFLICT DO NOTHING;

-- ── Typhoid Fever ───────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Fever',             1.0),
  ('Headache',          0.8),
  ('Abdominal Pain',    0.8),
  ('Weakness',          0.8),
  ('Loss of Appetite',  0.75),
  ('Nausea',            0.6),
  ('Diarrhea',          0.5),
  ('Constipation',      0.5),
  ('Body Ache',         0.6),
  ('Rash',              0.4)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Typhoid Fever'
ON CONFLICT DO NOTHING;

-- ── Malaria ─────────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Fever',             1.0),
  ('Chills',            0.95),
  ('Sweating',          0.9),
  ('Headache',          0.8),
  ('Body Ache',         0.8),
  ('Fatigue',           0.75),
  ('Nausea',            0.6),
  ('Vomiting',          0.5),
  ('Diarrhea',          0.3)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Malaria'
ON CONFLICT DO NOTHING;

-- ── Dengue Fever ────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Fever',             1.0),
  ('Severe Headache',   0.9),
  ('Eye Pain',          0.85),
  ('Joint Pain',        0.9),
  ('Body Ache',         0.85),
  ('Rash',              0.75),
  ('Fatigue',           0.7),
  ('Nausea',            0.6),
  ('Vomiting',          0.5),
  ('Bleeding Gums',     0.5)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Dengue Fever'
ON CONFLICT DO NOTHING;

-- ── Scabies ─────────────────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Itching',           1.0),
  ('Rash',              0.9),
  ('Skin Burrows',      0.95),
  ('Night Itching',     0.9)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Scabies'
ON CONFLICT DO NOTHING;

-- ── Skin Allergy / Urticaria ────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Itching',           0.95),
  ('Rash',              0.95),
  ('Hives',             1.0),
  ('Swelling',          0.7),
  ('Redness',           0.8)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Skin Allergy / Urticaria'
ON CONFLICT DO NOTHING;

-- ── Acute Tonsillitis ───────────────────────────────────────────────────────
INSERT INTO disease_symptoms (disease_id, symptom_id, weight)
SELECT d.id, s.id, v.weight
FROM diseases d
JOIN (VALUES
  ('Sore Throat',       1.0),
  ('Fever',             0.85),
  ('Difficulty Swallowing', 0.9),
  ('Swollen Tonsils',   1.0),
  ('Headache',          0.5),
  ('Fatigue',           0.4),
  ('Bad Breath',        0.6)
) AS v(symptom_name, weight) ON true
JOIN symptoms s ON lower(s.name) = lower(v.symptom_name)
WHERE d.name = 'Acute Tonsillitis'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DISEASE → MEDICINE MAPPINGS
-- rank: 1=first-line, 2=second-line, 3=adjunct
-- is_first_line: true for primary treatment
-- Matches on brand_name (case-insensitive). Also tries generic_name if no match.
-- =============================================================================

-- ── Upper Respiratory Tract Infection ──────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Paracetamol',    1, true),
  ('Ibuprofen',      2, false),
  ('Cetirizine',     2, false),
  ('Amoxicillin',    3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Upper Respiratory Tract Infection'
ON CONFLICT DO NOTHING;

-- ── Influenza ───────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Paracetamol',    1, true),
  ('Ibuprofen',      2, false),
  ('Oseltamivir',    1, true),
  ('Cetirizine',     3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Influenza'
ON CONFLICT DO NOTHING;

-- ── Pneumonia ───────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Amoxicillin',      1, true),
  ('Azithromycin',     1, true),
  ('Ceftriaxone',      2, false),
  ('Paracetamol',      3, false),
  ('Levofloxacin',     2, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Pneumonia'
ON CONFLICT DO NOTHING;

-- ── Asthma ──────────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Salbutamol',       1, true),
  ('Budesonide',       1, true),
  ('Montelukast',      2, false),
  ('Ipratropium',      2, false),
  ('Prednisolone',     3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Asthma'
ON CONFLICT DO NOTHING;

-- ── Urinary Tract Infection ─────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Ciprofloxacin',    1, true),
  ('Trimethoprim',     1, true),
  ('Nitrofurantoin',   1, true),
  ('Amoxicillin',      2, false),
  ('Ceftriaxone',      3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Urinary Tract Infection'
ON CONFLICT DO NOTHING;

-- ── Hypertension ────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Amlodipine',       1, true),
  ('Lisinopril',       1, true),
  ('Losartan',         1, true),
  ('Atenolol',         2, false),
  ('Hydrochlorothiazide', 2, false),
  ('Metoprolol',       2, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Hypertension'
ON CONFLICT DO NOTHING;

-- ── Type 2 Diabetes ─────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Metformin',        1, true),
  ('Glibenclamide',    2, false),
  ('Sitagliptin',      2, false),
  ('Insulin',          3, false),
  ('Empagliflozin',    2, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Type 2 Diabetes'
ON CONFLICT DO NOTHING;

-- ── Acute Gastroenteritis ───────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('ORS',              1, true),
  ('Metronidazole',    1, true),
  ('Ciprofloxacin',    2, false),
  ('Loperamide',       2, false),
  ('Domperidone',      3, false),
  ('Ondansetron',      3, false),
  ('Zinc',             3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Acute Gastroenteritis'
ON CONFLICT DO NOTHING;

-- ── Peptic Ulcer Disease ────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Omeprazole',       1, true),
  ('Pantoprazole',     1, true),
  ('Amoxicillin',      2, false),
  ('Clarithromycin',   2, false),
  ('Metronidazole',    2, false),
  ('Ranitidine',       3, false),
  ('Antacid',          3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Peptic Ulcer Disease'
ON CONFLICT DO NOTHING;

-- ── Migraine ────────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Sumatriptan',      1, true),
  ('Ibuprofen',        1, true),
  ('Paracetamol',      2, false),
  ('Metoclopramide',   2, false),
  ('Propranolol',      3, false),
  ('Amitriptyline',    3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Migraine'
ON CONFLICT DO NOTHING;

-- ── Iron Deficiency Anemia ──────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Ferrous Sulfate',  1, true),
  ('Ferrous Fumarate', 1, true),
  ('Folic Acid',       2, false),
  ('Vitamin C',        3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Iron Deficiency Anemia'
ON CONFLICT DO NOTHING;

-- ── Typhoid Fever ───────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Ceftriaxone',      1, true),
  ('Ciprofloxacin',    1, true),
  ('Azithromycin',     2, false),
  ('Paracetamol',      3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Typhoid Fever'
ON CONFLICT DO NOTHING;

-- ── Malaria ─────────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Artemether',       1, true),
  ('Chloroquine',      1, true),
  ('Primaquine',       2, false),
  ('Quinine',          2, false),
  ('Paracetamol',      3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Malaria'
ON CONFLICT DO NOTHING;

-- ── Dengue Fever ────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Paracetamol',      1, true),
  ('ORS',              1, true)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Dengue Fever'
ON CONFLICT DO NOTHING;

-- ── Scabies ─────────────────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Permethrin',       1, true),
  ('Ivermectin',       1, true),
  ('Cetirizine',       2, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Scabies'
ON CONFLICT DO NOTHING;

-- ── Skin Allergy / Urticaria ────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Cetirizine',       1, true),
  ('Loratadine',       1, true),
  ('Prednisolone',     2, false),
  ('Hydroxyzine',      2, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Skin Allergy / Urticaria'
ON CONFLICT DO NOTHING;

-- ── Acute Tonsillitis ───────────────────────────────────────────────────────
INSERT INTO disease_medicines (disease_id, medicine_id, rank, is_first_line, frequency)
SELECT d.id, m.id, v.rank, v.first_line, 0
FROM diseases d
JOIN (VALUES
  ('Amoxicillin',      1, true),
  ('Azithromycin',     2, false),
  ('Paracetamol',      2, false),
  ('Ibuprofen',        3, false)
) AS v(med_name, rank, first_line) ON true
JOIN medicines m ON lower(m.brand_name) = lower(v.med_name)
                 OR lower(m.generic_name) = lower(v.med_name)
WHERE d.name = 'Acute Tonsillitis'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DISEASE → TEST MAPPINGS
-- rank: 1=essential/first-order, 2=confirmatory, 3=additional
-- Matches on test_name (case-insensitive)
-- =============================================================================

-- ── Upper Respiratory Tract Infection ──────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('CBC',              1, false),
  ('Throat Culture',   2, false),
  ('CRP',              2, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Upper Respiratory Tract Infection'
ON CONFLICT DO NOTHING;

-- ── Influenza ───────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('CBC',              1, true),
  ('Influenza Rapid Test', 1, false),
  ('CRP',              2, false),
  ('Chest X-Ray',      3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Influenza'
ON CONFLICT DO NOTHING;

-- ── Pneumonia ───────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Chest X-Ray',      1, true),
  ('CBC',              1, true),
  ('CRP',              2, false),
  ('Sputum Culture',   2, false),
  ('Blood Culture',    3, false),
  ('Procalcitonin',    3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Pneumonia'
ON CONFLICT DO NOTHING;

-- ── Asthma ──────────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Peak Flow Rate',   1, true),
  ('Spirometry',       1, true),
  ('Chest X-Ray',      2, false),
  ('Allergy Panel',    2, false),
  ('IgE Level',        3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Asthma'
ON CONFLICT DO NOTHING;

-- ── Urinary Tract Infection ─────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Urine R/E',        1, true),
  ('Urine Culture',    1, true),
  ('CBC',              2, false),
  ('Urine CS',         2, false),
  ('Renal Ultrasound', 3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Urinary Tract Infection'
ON CONFLICT DO NOTHING;

-- ── Hypertension ────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('ECG',              1, true),
  ('Renal Function Tests', 1, true),
  ('Urine R/E',        1, false),
  ('Lipid Profile',    2, false),
  ('Blood Sugar Fasting', 2, false),
  ('Echo',             3, false),
  ('Fundoscopy',       3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Hypertension'
ON CONFLICT DO NOTHING;

-- ── Type 2 Diabetes ─────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Blood Sugar Fasting', 1, true),
  ('HbA1c',            1, true),
  ('Blood Sugar Random', 1, false),
  ('Urine R/E',        2, false),
  ('Lipid Profile',    2, false),
  ('Renal Function Tests', 2, false),
  ('Liver Function Tests', 3, false),
  ('ECG',              3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Type 2 Diabetes'
ON CONFLICT DO NOTHING;

-- ── Acute Gastroenteritis ───────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Stool R/E',        1, true),
  ('CBC',              1, false),
  ('Stool Culture',    2, false),
  ('Electrolytes',     2, false),
  ('Renal Function Tests', 3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Acute Gastroenteritis'
ON CONFLICT DO NOTHING;

-- ── Peptic Ulcer Disease ────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('H. Pylori Test',   1, true),
  ('CBC',              1, false),
  ('Endoscopy',        2, false),
  ('Stool Occult Blood', 2, false),
  ('Liver Function Tests', 3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Peptic Ulcer Disease'
ON CONFLICT DO NOTHING;

-- ── Migraine ────────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('CBC',              1, false),
  ('CT Brain',         2, false),
  ('MRI Brain',        3, false),
  ('Blood Pressure',   1, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Migraine'
ON CONFLICT DO NOTHING;

-- ── Iron Deficiency Anemia ──────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('CBC',              1, true),
  ('Serum Ferritin',   1, true),
  ('Serum Iron',       2, false),
  ('TIBC',             2, false),
  ('Peripheral Smear', 3, false),
  ('Stool Occult Blood', 2, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Iron Deficiency Anemia'
ON CONFLICT DO NOTHING;

-- ── Typhoid Fever ───────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Typhoid Test (Widal)', 1, true),
  ('Typhoid Rapid Test', 1, true),
  ('Blood Culture',    1, true),
  ('CBC',              1, false),
  ('Liver Function Tests', 2, false),
  ('Stool Culture',    3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Typhoid Fever'
ON CONFLICT DO NOTHING;

-- ── Malaria ─────────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Malaria RDT',      1, true),
  ('Malaria Blood Smear', 1, true),
  ('CBC',              1, false),
  ('Liver Function Tests', 2, false),
  ('Kidney Function Tests', 2, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Malaria'
ON CONFLICT DO NOTHING;

-- ── Dengue Fever ────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Dengue NS1',       1, true),
  ('Dengue IgM/IgG',   1, true),
  ('CBC',              1, true),
  ('Platelet Count',   1, true),
  ('Liver Function Tests', 2, false),
  ('Coagulation Profile', 3, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Dengue Fever'
ON CONFLICT DO NOTHING;

-- ── Scabies ─────────────────────────────────────────────────────────────────
INSERT INTO disease_tests (disease_id, test_id, rank, is_essential, frequency)
SELECT d.id, t.id, v.rank, v.essential, 0
FROM diseases d
JOIN (VALUES
  ('Skin Scraping',    1, false),
  ('CBC',              2, false)
) AS v(test_name, rank, essential) ON true
JOIN tests t ON lower(t.test_name) = lower(v.test_name)
WHERE d.name = 'Scabies'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES (run these manually to check what was seeded)
-- =============================================================================
-- SELECT COUNT(*) FROM diseases;
-- SELECT COUNT(*) FROM disease_symptoms;
-- SELECT COUNT(*) FROM disease_medicines;
-- SELECT COUNT(*) FROM disease_tests;
--
-- To see which disease mappings were created (adjust limit):
-- SELECT d.name, COUNT(ds.symptom_id) AS symptoms,
--        COUNT(DISTINCT dm.medicine_id) AS medicines,
--        COUNT(DISTINCT dt.test_id) AS tests
-- FROM diseases d
-- LEFT JOIN disease_symptoms ds ON ds.disease_id = d.id
-- LEFT JOIN disease_medicines dm ON dm.disease_id = d.id
-- LEFT JOIN disease_tests dt ON dt.disease_id = d.id
-- GROUP BY d.name ORDER BY symptoms DESC;
-- =============================================================================
