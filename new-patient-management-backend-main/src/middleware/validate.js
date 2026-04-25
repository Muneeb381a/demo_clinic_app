// src/middleware/validate.js
// Zod-based request validation middleware.
// Usage: router.post('/patients', validate(createPatientSchema), createPatient)

import { z } from "zod";

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On failure it responds with 400 and a list of field errors.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }
  req.body = result.data; // replace with parsed (coerced + stripped) data
  next();
};

// ─── Schemas ────────────────────────────────────────────────────────────────

export const createPatientSchema = z.object({
  name:   z.string().min(1).max(100),
  mobile: z.string().regex(/^\+?\d{10,15}$/, "Invalid mobile number"),
  age:    z.coerce.number().int().min(0).max(150).optional(),
  // Accept any casing/variant the frontend sends; normalise to lowercase
  gender: z.string()
    .transform((v) => v.toLowerCase().replace("others", "other"))
    .pipe(z.enum(["male", "female", "other"]))
    .optional(),
  weight: z.coerce.number().positive().optional(),
  height: z.coerce.number().positive().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const createConsultationSchema = z.object({
  patient_id:  z.coerce.number().int().positive(),
  doctor_name: z.string().min(1).max(100),
  visit_date:  z.string().optional(),
});

export const createPrescriptionSchema = z.object({
  consultation_id: z.number().int().positive(),
  medicines: z.array(z.object({
    medicine_id:      z.number().int().positive(),
    dosage_en:        z.string().min(1),
    dosage_urdu:      z.string().min(1),
    frequency_en:     z.string().min(1),
    frequency_urdu:   z.string().min(1),
    duration_en:      z.string().min(1),
    duration_urdu:    z.string().min(1),
    instructions_en:  z.string().min(1),
    instructions_urdu:z.string().min(1),
    how_to_take_en:   z.string().nullable().optional(),
    how_to_take_urdu: z.string().nullable().optional(),
  })).min(1),
});

export const scheduleFollowUpSchema = z.object({
  follow_up_date: z.string().min(1, "Follow-up date is required"),
  notes:          z.string().max(500).optional(),
});

export const recordVitalsSchema = z.object({
  consultation_id: z.number().int().positive(),
  patient_id:      z.number().int().positive(),
  pulse_rate:      z.number().int().min(0).max(300).nullable().optional(),
  blood_pressure:  z.string().max(20).nullable().optional(),
  temperature:     z.number().min(30).max(45).nullable().optional(),
  spo2_level:      z.number().min(0).max(100).nullable().optional(),
  nihss_score:     z.number().int().min(0).max(42).nullable().optional(),
  fall_assessment: z.string().max(100).nullable().optional(),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name:           z.string().min(1).max(100),
  email:          z.string().email(),
  password:       z.string().min(8, "Password must be at least 8 characters"),
  specialization: z.string().max(100).optional(),
});
