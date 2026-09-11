// src/controllers/publicController.js
// Unauthenticated endpoints safe to expose to anyone — currently just the
// per-clinic branding lookup used by the login page when it's opened from a
// clinic's own subdomain (see src/utils/tenant.js on the frontend). Only
// ever returns display-safe fields (name, slug) — never seat counts, staff,
// or anything else about the clinic.

import { pool } from "../models/db.js";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * GET /api/public/clinics/by-slug/:slug
 * Used by the login page to greet a visitor with their clinic's name when
 * it's opened from <slug>.yourapp.com. A suspended or unknown clinic just
 * gets a generic login screen — this never reveals which slugs exist.
 */
export const getClinicBySlug = async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) {
    return res.status(404).json({ success: false, message: "Clinic not found" });
  }

  try {
    const result = await pool.query(
      "SELECT name, slug FROM clinics WHERE slug = $1 AND status = 'active'",
      [slug]
    );
    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }
    res.json({ success: true, clinic: result.rows[0] });
  } catch (error) {
    console.error("getClinicBySlug error:", error.message);
    res.status(500).json({ success: false, message: "Failed to look up clinic" });
  }
};
