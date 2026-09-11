// src/controllers/platformController.js
// Platform-admin only (see routes/platformRoutes.js): create and manage
// clinics. There is exactly one platform admin — the app operator — bootstrapped
// by hand after migrating (see migrations/0005_clinics.sql).

import { pool } from "../models/db.js";
import bcrypt from "bcryptjs";
import { cacheDel } from "../utils/cache.js";
import { PLAN_PRESETS, FEATURE_KEYS, isValidPlan } from "../config/plans.js";

const BCRYPT_ROUNDS = 12;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Only known keys survive into the DB — an unrecognized flag in the request
// body is silently dropped rather than stored, so `clinics.features` never
// drifts from what requireFeature() actually knows how to check.
const sanitizeFeatures = (features) => {
  if (!features || typeof features !== "object") return {};
  const out = {};
  for (const key of FEATURE_KEYS) {
    if (key in features) out[key] = Boolean(features[key]);
  }
  return out;
};

/**
 * POST /api/platform/clinics
 * Creates a clinic and its first user (the owner) in one transaction.
 * Body: { name, slug, plan?, max_doctors?, max_receptionists?, features?,
 *         owner: { name, email, password, specialization? } }
 * `plan` ('clinic' | 'hospital', default 'clinic') fills max_doctors/
 * max_receptionists/features with its preset wherever the caller didn't
 * explicitly pass one — see src/config/plans.js.
 */
export const createClinic = async (req, res) => {
  const { name, slug, plan = "clinic", max_doctors, max_receptionists, features, owner } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ success: false, message: "name and slug are required" });
  }
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({
      success: false,
      message: "slug must be lowercase letters, digits and hyphens only (e.g. 'green-valley-clinic')",
    });
  }
  if (!isValidPlan(plan)) {
    return res.status(400).json({ success: false, message: `plan must be one of: ${Object.keys(PLAN_PRESETS).join(", ")}` });
  }
  if (!owner?.name || !owner?.email || !owner?.password) {
    return res.status(400).json({ success: false, message: "owner.name, owner.email and owner.password are required" });
  }
  if (owner.password.length < 8) {
    return res.status(400).json({ success: false, message: "owner.password must be at least 8 characters" });
  }

  const preset = PLAN_PRESETS[plan];
  const maxDoctors = Number.isInteger(max_doctors) && max_doctors > 0 ? max_doctors : preset.max_doctors;
  const maxReceptionists = Number.isInteger(max_receptionists) && max_receptionists >= 0 ? max_receptionists : preset.max_receptionists;
  const clinicFeatures = features !== undefined ? sanitizeFeatures(features) : preset.features;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingEmail = await client.query("SELECT id FROM auth_users WHERE email = $1", [owner.email.toLowerCase()]);
    if (existingEmail.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "owner email already registered" });
    }

    const clinicRes = await client.query(
      `INSERT INTO clinics (name, slug, max_doctors, max_receptionists, plan, features)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, slug, maxDoctors, maxReceptionists, plan, JSON.stringify(clinicFeatures)]
    );
    const clinic = clinicRes.rows[0];

    const passwordHash = await bcrypt.hash(owner.password, BCRYPT_ROUNDS);
    const ownerRes = await client.query(
      `INSERT INTO auth_users (name, email, password_hash, salt, role, specialization, clinic_id, is_owner)
       VALUES ($1, $2, $3, '', 'doctor', $4, $5, true)
       RETURNING id, name, email, role, clinic_id, is_owner`,
      [owner.name, owner.email.toLowerCase(), passwordHash, owner.specialization || null, clinic.id]
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true, clinic, owner: ownerRes.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "slug already in use" });
    }
    console.error("createClinic error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create clinic" });
  } finally {
    client.release();
  }
};

/**
 * GET /api/platform/clinics
 * Lists every clinic with current staff counts against its seat limits.
 */
export const listClinics = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(u.id) FILTER (WHERE u.role = 'doctor')       AS doctor_count,
        COUNT(u.id) FILTER (WHERE u.role = 'receptionist') AS receptionist_count
      FROM clinics c
      LEFT JOIN auth_users u ON u.clinic_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, clinics: result.rows });
  } catch (error) {
    console.error("listClinics error:", error.message);
    res.status(500).json({ success: false, message: "Failed to list clinics" });
  }
};

/**
 * PATCH /api/platform/clinics/:id
 * Body: any of { name, max_doctors, max_receptionists, status, plan, features }
 * status must be 'active' or 'suspended'; plan must be a known preset name.
 *
 * `plan` re-applies that plan's *feature* defaults only (seat limits are
 * never silently overwritten by a plan switch — a clinic that already
 * negotiated a custom max_doctors keeps it). Pass `features` in the same
 * request to override individual flags on top of the plan's defaults, or
 * pass `features` alone (no `plan`) to toggle flags without changing plan.
 */
export const updateClinic = async (req, res) => {
  const { id } = req.params;
  const { name, max_doctors, max_receptionists, status, plan, features } = req.body;

  if (status !== undefined && !["active", "suspended"].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be 'active' or 'suspended'" });
  }
  if (plan !== undefined && !isValidPlan(plan)) {
    return res.status(400).json({ success: false, message: `plan must be one of: ${Object.keys(PLAN_PRESETS).join(", ")}` });
  }

  const fields = [];
  const values = [];
  const set = (col, val) => {
    values.push(val);
    fields.push(`${col} = $${values.length}`);
  };
  if (name !== undefined) set("name", name);
  if (max_doctors !== undefined) set("max_doctors", max_doctors);
  if (max_receptionists !== undefined) set("max_receptionists", max_receptionists);
  if (status !== undefined) set("status", status);
  if (plan !== undefined) set("plan", plan);

  // features: plan's preset first, then an explicit `features` body merges
  // on top of it (or of the clinic's current features, if `plan` wasn't
  // also given) — a single-flag toggle never has to resend every flag.
  if (plan !== undefined && features !== undefined) {
    set("features", JSON.stringify({ ...PLAN_PRESETS[plan].features, ...sanitizeFeatures(features) }));
  } else if (plan !== undefined) {
    set("features", JSON.stringify(PLAN_PRESETS[plan].features));
  } else if (features !== undefined) {
    // No plan given — merge onto whatever's already stored, DB-side, since
    // the current value isn't known here without an extra read.
    values.push(JSON.stringify(sanitizeFeatures(features)));
    fields.push(`features = features || $${values.length}`);
  }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, message: "No fields to update" });
  }

  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE clinics SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }
    await cacheDel(`clinic:status:${id}`);   // requireActiveClinic caches this
    await cacheDel(`clinic:features:${id}`); // requireFeature caches this
    res.json({ success: true, clinic: result.rows[0] });
  } catch (error) {
    console.error("updateClinic error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update clinic" });
  }
};
