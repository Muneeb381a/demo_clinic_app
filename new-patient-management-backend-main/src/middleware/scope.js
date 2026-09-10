// src/middleware/scope.js
// Per-doctor data isolation helpers. Every patient belongs to one doctor
// (auth_users row); consultations inherit that ownership through their patient.
// Admins (role === "admin") bypass the filter and see everything.
//
// Ownership checks return 404 rather than 403 on purpose — a doctor should not
// be able to probe whether another doctor's patient id exists.

import { pool } from "../models/db.js";
import { ApiError } from "../utils/ApiError.js";

export const isAdmin = (user) => user?.role === "admin";

/**
 * SQL fragment + params for restricting a query to the caller's patients.
 * `column` is the qualified doctor_id column for the query (e.g. "p.doctor_id").
 * Returns { text: "", params: [] } for admins.
 *
 *   const s = patientScope(req.user, "patients.doctor_id", 3); // next placeholder is $3
 *   `... WHERE name ILIKE $2 ${s.text}`   ->  "... AND patients.doctor_id = $3"
 */
export const patientScope = (user, column = "doctor_id", nextParamIndex = 1) => {
  if (isAdmin(user)) return { text: "", params: [] };
  return { text: ` AND ${column} = $${nextParamIndex}`, params: [user.id] };
};

/** Throws ApiError(404) unless the patient exists and belongs to the caller. */
export const assertPatientOwned = async (patientId, user, client = pool) => {
  const sql = isAdmin(user)
    ? "SELECT 1 FROM patients WHERE id = $1"
    : "SELECT 1 FROM patients WHERE id = $1 AND doctor_id = $2";
  const params = isAdmin(user) ? [patientId] : [patientId, user.id];
  const { rowCount } = await client.query(sql, params);
  if (!rowCount) throw new ApiError(404, "Patient not found");
};

/** Throws ApiError(404) unless the consultation exists and its patient belongs to the caller. */
export const assertConsultationOwned = async (consultationId, user, client = pool) => {
  const sql = isAdmin(user)
    ? "SELECT 1 FROM consultations WHERE id = $1"
    : `SELECT 1 FROM consultations c
         JOIN patients p ON p.id = c.patient_id
        WHERE c.id = $1 AND p.doctor_id = $2`;
  const params = isAdmin(user) ? [consultationId] : [consultationId, user.id];
  const { rowCount } = await client.query(sql, params);
  if (!rowCount) throw new ApiError(404, "Consultation not found");
};
