// src/db/schema.js — Drizzle schema (Option A: definition + push only).
// All controllers continue to use raw pool.query(); this file drives table creation.

import {
  pgTable, serial, varchar, text, integer, boolean,
  numeric, date, timestamp, smallint, jsonb, primaryKey,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// PostgreSQL native integer[] — no built-in Drizzle type
const intArray = customType({
  dataType() { return "integer[]"; },
  toDriver(val) { return val; },
  fromDriver(val) { return val; },
});

// ── Auth ────────────────────────────────────────────────────────────────────
export const authUsers = pgTable("auth_users", {
  id:             serial("id").primaryKey(),
  name:           varchar("name", { length: 100 }).notNull(),
  email:          varchar("email", { length: 255 }).notNull().unique(),
  passwordHash:   varchar("password_hash", { length: 255 }).notNull(),
  salt:           varchar("salt", { length: 64 }).notNull().default(""),
  role:           varchar("role", { length: 50 }).notNull().default("doctor"),
  specialization: varchar("specialization", { length: 100 }),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Patients ────────────────────────────────────────────────────────────────
export const patients = pgTable("patients", {
  id:          serial("id").primaryKey(),
  mobile:      varchar("mobile", { length: 20 }),
  mrNo:        varchar("mr_no", { length: 60 }).unique(),
  name:        varchar("name", { length: 200 }),
  age:         integer("age"),
  gender:      varchar("gender", { length: 20 }),
  weight:      numeric("weight", { precision: 6, scale: 2 }),
  height:      numeric("height", { precision: 6, scale: 2 }),
  checkupDate: date("checkup_date").default(sql`CURRENT_DATE`),
});

// ── Consultations ───────────────────────────────────────────────────────────
export const consultations = pgTable("consultations", {
  id:         serial("id").primaryKey(),
  patientId:  integer("patient_id").references(() => patients.id),
  doctorName: varchar("doctor_name", { length: 200 }),
  visitDate:  timestamp("visit_date", { withTimezone: true }).defaultNow(),
});

// ── Vital Signs ─────────────────────────────────────────────────────────────
export const vitalSigns = pgTable("vital_signs", {
  id:             serial("id").primaryKey(),
  consultationId: integer("consultation_id").references(() => consultations.id),
  patientId:      integer("patient_id").references(() => patients.id),
  pulseRate:      varchar("pulse_rate", { length: 20 }),
  bloodPressure:  varchar("blood_pressure", { length: 30 }),
  temperature:    varchar("temperature", { length: 20 }),
  spo2Level:      varchar("spo2_level", { length: 20 }),
  nihssScore:     integer("nihss_score"),
  fallAssessment: varchar("fall_assessment", { length: 100 }),
  recordedAt:     timestamp("recorded_at", { withTimezone: true }).defaultNow(),
});

// ── Symptoms ────────────────────────────────────────────────────────────────
export const symptoms = pgTable("symptoms", {
  id:       serial("id").primaryKey(),
  name:     varchar("name", { length: 200 }).unique(),
  isCustom: boolean("is_custom").default(false),
});

// ── Consultation ↔ Symptom ──────────────────────────────────────────────────
export const consultationSymptoms = pgTable("consultation_symptoms", {
  consultationId: integer("consultation_id").notNull().references(() => consultations.id, { onDelete: "cascade" }),
  symptomId:      integer("symptom_id").notNull().references(() => symptoms.id, { onDelete: "cascade" }),
  patientId:      integer("patient_id"),
}, (t) => ({
  pk: primaryKey({ columns: [t.consultationId, t.symptomId] }),
}));

// ── Medicines ───────────────────────────────────────────────────────────────
export const medicines = pgTable("medicines", {
  id:           serial("id").primaryKey(),
  brandName:    varchar("brand_name", { length: 200 }),
  genericName:  varchar("generic_name", { length: 200 }),
  form:         varchar("form", { length: 50 }),
  strength:     varchar("strength", { length: 100 }),
  urduName:     varchar("urdu_name", { length: 200 }),
  urduForm:     varchar("urdu_form", { length: 100 }),
  urduStrength: varchar("urdu_strength", { length: 100 }),
});

// ── Prescriptions ───────────────────────────────────────────────────────────
export const prescriptions = pgTable("prescriptions", {
  id:              serial("id").primaryKey(),
  consultationId:  integer("consultation_id").references(() => consultations.id),
  patientId:       integer("patient_id").references(() => patients.id),
  medicineId:      integer("medicine_id").references(() => medicines.id),
  dosageEn:        varchar("dosage_en", { length: 100 }),
  dosageUrdu:      varchar("dosage_urdu", { length: 200 }),
  frequencyEn:     varchar("frequency_en", { length: 100 }),
  frequencyUrdu:   varchar("frequency_urdu", { length: 200 }),
  durationEn:      varchar("duration_en", { length: 100 }),
  durationUrdu:    varchar("duration_urdu", { length: 200 }),
  instructionsEn:  text("instructions_en"),
  instructionsUrdu: text("instructions_urdu"),
  howToTakeEn:     text("how_to_take_en"),
  howToTakeUrdu:   text("how_to_take_urdu"),
  prescribedAt:    timestamp("prescribed_at", { withTimezone: true }).defaultNow(),
});

// ── Tests ───────────────────────────────────────────────────────────────────
export const tests = pgTable("tests", {
  id:        serial("id").primaryKey(),
  testName:  varchar("test_name", { length: 200 }),
  testNotes: text("test_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Consultation ↔ Test ─────────────────────────────────────────────────────
export const consultationTests = pgTable("consultation_tests", {
  consultationId: integer("consultation_id").notNull().references(() => consultations.id, { onDelete: "cascade" }),
  testId:         integer("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  assignedAt:     timestamp("assigned_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.consultationId, t.testId] }),
}));

// ── Neurological Exams ──────────────────────────────────────────────────────
export const neurologicalExams = pgTable("neurological_exams", {
  id:                    serial("id").primaryKey(),
  patientId:             integer("patient_id").references(() => patients.id),
  consultationId:        integer("consultation_id").references(() => consultations.id),
  motorFunction:         text("motor_function"),
  muscleTone:            text("muscle_tone"),
  muscleStrength:        text("muscle_strength"),
  deepTendonReflexes:    text("deep_tendon_reflexes"),
  plantarReflex:         text("plantar_reflex"),
  sensoryExamination:    text("sensory_examination"),
  painSensation:         boolean("pain_sensation").default(false),
  vibrationSense:        boolean("vibration_sense").default(false),
  proprioception:        boolean("proprioception").default(false),
  temperatureSensation:  boolean("temperature_sensation").default(false),
  coordination:          text("coordination"),
  fingerNoseTest:        text("finger_nose_test"),
  heelShinTest:          text("heel_shin_test"),
  gaitAssessment:        text("gait_assessment"),
  rombergTest:           text("romberg_test"),
  cranialNerves:         text("cranial_nerves"),
  pupillaryReaction:     text("pupillary_reaction"),
  eyeMovements:          text("eye_movements"),
  facialSensation:       boolean("facial_sensation").default(false),
  swallowingFunction:    boolean("swallowing_function").default(false),
  tongueMovement:        text("tongue_movement"),
  straightLegRaiseTest:  text("straight_leg_raise_test"),
  lasegueTest:           text("lasegue_test"),
  brudzinskiSign:        boolean("brudzinski_sign").default(false),
  kernigSign:            boolean("kernig_sign").default(false),
  cognitiveAssessment:   text("cognitive_assessment"),
  speechAssessment:      text("speech_assessment"),
  straightLegRaiseLeft:  text("straight_leg_raise_left"),
  straightLegRaiseRight: text("straight_leg_raise_right"),
  tremors:               text("tremors"),
  involuntaryMovements:  text("involuntary_movements"),
  diagnosis:             text("diagnosis"),
  treatmentPlan:         text("treatment_plan"),
  notes:                 text("notes"),
  fundoscopy:            text("fundoscopy"),
  mmseScore:             integer("mmse_score"),
  gcsScore:              integer("gcs_score"),
  power:                 text("power"),
  createdAt:             timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Follow-Ups ──────────────────────────────────────────────────────────────
export const followUps = pgTable("follow_ups", {
  id:             serial("id").primaryKey(),
  consultationId: integer("consultation_id").references(() => consultations.id),
  followUpDate:   date("follow_up_date"),
  notes:          text("notes").default("عام چیک اپ"),
  isCompleted:    boolean("is_completed").default(false),
});

// ── Medical Conditions ──────────────────────────────────────────────────────
export const medicalConditions = pgTable("medical_conditions", {
  id:            serial("id").primaryKey(),
  patientId:     integer("patient_id").references(() => patients.id),
  conditionName: varchar("condition_name", { length: 200 }),
  duration:      varchar("duration", { length: 100 }),
  diagnosisDate: date("diagnosis_date"),
  notes:         text("notes"),
});

// ── Chatbot Cache ───────────────────────────────────────────────────────────
export const chatbotCache = pgTable("chatbot_cache", {
  inputHash:   varchar("input_hash", { length: 40 }).primaryKey(),
  keywordHash: varchar("keyword_hash", { length: 40 }),
  response:    jsonb("response").notNull(),
  inputSample: text("input_sample"),
  hitCount:    integer("hit_count").default(1),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt:   timestamp("expires_at", { withTimezone: true }).default(sql`NOW() + INTERVAL '30 days'`),
});

// ── Disease Knowledge Graph ─────────────────────────────────────────────────
export const diseases = pgTable("diseases", {
  id:          serial("id").primaryKey(),
  name:        varchar("name", { length: 200 }).notNull().unique(),
  icd10Code:   varchar("icd10_code", { length: 20 }),
  category:    varchar("category", { length: 100 }),
  description: text("description"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const diseaseSymptoms = pgTable("disease_symptoms", {
  diseaseId: integer("disease_id").notNull().references(() => diseases.id, { onDelete: "cascade" }),
  symptomId: integer("symptom_id").notNull().references(() => symptoms.id, { onDelete: "cascade" }),
  weight:    numeric("weight", { precision: 3, scale: 2 }).notNull().default("0.5"),
}, (t) => ({
  pk: primaryKey({ columns: [t.diseaseId, t.symptomId] }),
}));

export const diseaseMedicines = pgTable("disease_medicines", {
  diseaseId:   integer("disease_id").notNull().references(() => diseases.id, { onDelete: "cascade" }),
  medicineId:  integer("medicine_id").notNull().references(() => medicines.id, { onDelete: "cascade" }),
  rank:        smallint("rank").notNull().default(1),
  isFirstLine: boolean("is_first_line").notNull().default(false),
  frequency:   integer("frequency").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.diseaseId, t.medicineId] }),
}));

export const diseaseTests = pgTable("disease_tests", {
  diseaseId:   integer("disease_id").notNull().references(() => diseases.id, { onDelete: "cascade" }),
  testId:      integer("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  rank:        smallint("rank").notNull().default(1),
  isEssential: boolean("is_essential").notNull().default(false),
  frequency:   integer("frequency").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.diseaseId, t.testId] }),
}));

export const symptomAliases = pgTable("symptom_aliases", {
  id:        serial("id").primaryKey(),
  symptomId: integer("symptom_id").notNull().references(() => symptoms.id, { onDelete: "cascade" }),
  alias:     varchar("alias", { length: 200 }).notNull(),
  language:  varchar("language", { length: 10 }).notNull().default("en"),
});

export const suggestionFeedback = pgTable("suggestion_feedback", {
  id:                   serial("id").primaryKey(),
  consultationId:       integer("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
  symptomIds:           intArray("symptom_ids").notNull(),
  suggestedDiseaseIds:  intArray("suggested_disease_ids"),
  acceptedMedicineIds:  intArray("accepted_medicine_ids").notNull().default(sql`'{}'`),
  dismissedMedicineIds: intArray("dismissed_medicine_ids").notNull().default(sql`'{}'`),
  acceptedTestIds:      intArray("accepted_test_ids").notNull().default(sql`'{}'`),
  dismissedTestIds:     intArray("dismissed_test_ids").notNull().default(sql`'{}'`),
  processed:            boolean("processed").notNull().default(false),
  createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Neuro Option Lookup Tables (20 identical-structure tables) ──────────────
const neuroOption = (tableName) => pgTable(tableName, {
  id:    serial("id").primaryKey(),
  value: varchar("value", { length: 200 }).notNull().unique(),
});

export const motorFunctionOptions         = neuroOption("motor_function_options");
export const muscleToneOptions            = neuroOption("muscle_tone_options");
export const muscleStrengthOptions        = neuroOption("muscle_strength_options");
export const deepTendonReflexesOptions    = neuroOption("deep_tendon_reflexes_options");
export const plantarReflexOptions         = neuroOption("plantar_reflex_options");
export const pupillaryReactionOptions     = neuroOption("pupillary_reaction_options");
export const speechAssessmentOptions      = neuroOption("speech_assessment_options");
export const gaitAssessmentOptions        = neuroOption("gait_assessment_options");
export const coordinationOptions          = neuroOption("coordination_options");
export const sensoryExaminationOptions    = neuroOption("sensory_examination_options");
export const cranialNervesOptions         = neuroOption("cranial_nerves_options");
export const mentalStatusOptions          = neuroOption("mental_status_options");
export const cerebellarFunctionOptions    = neuroOption("cerebellar_function_options");
export const muscleWastingOptions         = neuroOption("muscle_wasting_options");
export const abnormalMovementsOptions     = neuroOption("abnormal_movements_options");
export const rombergTestOptions           = neuroOption("romberg_test_options");
export const nystagmusOptions             = neuroOption("nystagmus_options");
export const fundoscopyOptions            = neuroOption("fundoscopy_options");
export const straightLegRaiseLeftOptions  = neuroOption("straight_leg_raise_left_options");
export const straightLegRaiseRightOptions = neuroOption("straight_leg_raise_right_options");
