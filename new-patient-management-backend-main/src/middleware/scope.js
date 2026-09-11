// src/middleware/scope.js
// Clinic-wide data isolation helpers. Every patient belongs to one clinic
// (auth_users.clinic_id / patients.clinic_id); consultations inherit that
// scope through their patient. All staff (doctors + receptionists) in a
// clinic share its patient pool — doctor_id / created_by record who actually
// did something, not who is allowed to see it.
//
// Platform admins (role === "platform_admin") bypass the filter and see
// everything; there is exactly one such account (the app operator).
//
// Ownership checks return 404 rather than 403 on purpose — staff should not
// be able to probe whether another clinic's patient id exists.

import { pool } from "../models/db.js";
import { ApiError } from "../utils/ApiError.js";

export const isPlatformAdmin = (user) => user?.role === "platform_admin";

/**
 * SQL fragment + params for restricting a query to the caller's clinic.
 * `column` is the qualified clinic_id column for the query (e.g. "p.clinic_id").
 * Returns { text: "", params: [] } for platform admins.
 *
 *   const s = clinicScope(req.user, "patients.clinic_id", 3); // next placeholder is $3
 *   `... WHERE name ILIKE $2 ${s.text}`   ->  "... AND patients.clinic_id = $3"
 */
export const clinicScope = (user, column = "clinic_id", nextParamIndex = 1) => {
  if (isPlatformAdmin(user)) return { text: "", params: [] };
  return { text: ` AND ${column} = $${nextParamIndex}`, params: [user.clinic_id] };
};

/**
 * Boolean ownership checks for controllers that catch-and-500 on throw
 * (most of this codebase). Return false instead of throwing so the caller
 * can `return res.status(404)`. Platform admins pass everything.
 */
export const patientOwned = async (patientId, user, client = pool) => {
  const sql = isPlatformAdmin(user)
    ? "SELECT 1 FROM patients WHERE id = $1"
    : "SELECT 1 FROM patients WHERE id = $1 AND clinic_id = $2";
  const params = isPlatformAdmin(user) ? [patientId] : [patientId, user.clinic_id];
  const { rowCount } = await client.query(sql, params);
  return rowCount > 0;
};

export const consultationOwned = async (consultationId, user, client = pool) => {
  const sql = isPlatformAdmin(user)
    ? "SELECT 1 FROM consultations WHERE id = $1"
    : `SELECT 1 FROM consultations c JOIN patients p ON p.id = c.patient_id
        WHERE c.id = $1 AND p.clinic_id = $2`;
  const params = isPlatformAdmin(user) ? [consultationId] : [consultationId, user.clinic_id];
  const { rowCount } = await client.query(sql, params);
  return rowCount > 0;
};

/** Throws ApiError(404) unless the patient exists and belongs to the caller's clinic. */
export const assertPatientOwned = async (patientId, user, client = pool) => {
  const sql = isPlatformAdmin(user)
    ? "SELECT 1 FROM patients WHERE id = $1"
    : "SELECT 1 FROM patients WHERE id = $1 AND clinic_id = $2";
  const params = isPlatformAdmin(user) ? [patientId] : [patientId, user.clinic_id];
  const { rowCount } = await client.query(sql, params);
  if (!rowCount) throw new ApiError(404, "Patient not found");
};

/** Throws ApiError(404) unless the consultation exists and its patient belongs to the caller's clinic. */
export const assertConsultationOwned = async (consultationId, user, client = pool) => {
  const sql = isPlatformAdmin(user)
    ? "SELECT 1 FROM consultations WHERE id = $1"
    : `SELECT 1 FROM consultations c
         JOIN patients p ON p.id = c.patient_id
        WHERE c.id = $1 AND p.clinic_id = $2`;
  const params = isPlatformAdmin(user) ? [consultationId] : [consultationId, user.clinic_id];
  const { rowCount } = await client.query(sql, params);
  if (!rowCount) throw new ApiError(404, "Consultation not found");
};
