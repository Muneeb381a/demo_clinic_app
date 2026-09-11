// src/middleware/clinicStatus.js
// Two clinic-level gates, same shape: requireActiveClinic blocks every
// request from a suspended clinic's staff; requireFeature blocks a route
// the clinic's plan doesn't include (see src/config/plans.js). Platform
// admins have no clinic_id and are unaffected by either. Both are cached
// briefly (they change only via PATCH /api/platform/clinics/:id, which
// invalidates both keys) so normal traffic doesn't add a DB round-trip.

import { pool } from "../models/db.js";
import { cacheGet, cacheSet } from "../utils/cache.js";

const STATUS_TTL = 30; // seconds

export const requireActiveClinic = async (req, res, next) => {
  if (!req.user?.clinic_id) return next(); // platform admin

  try {
    const cacheKey = `clinic:status:${req.user.clinic_id}`;
    let status = await cacheGet(cacheKey);

    if (!status) {
      const { rows } = await pool.query("SELECT status FROM clinics WHERE id = $1", [req.user.clinic_id]);
      status = rows[0]?.status || "active";
      await cacheSet(cacheKey, status, STATUS_TTL);
    }

    if (status !== "active") {
      return res.status(403).json({ success: false, message: "This clinic account has been suspended" });
    }
    next();
  } catch (err) {
    // Fail open on a cache/DB hiccup rather than locking everyone out.
    next();
  }
};

/**
 * Gates a route behind one of the clinic's plan feature flags
 * (clinics.features, see src/config/plans.js) — e.g.
 * `router.use(requireFeature("ai_suggestions"))`. Platform admins (no
 * clinic_id) bypass it, same as requireActiveClinic. Cached the same way
 * (updateClinic's cacheDel keeps this fresh on a plan/feature change).
 */
export const requireFeature = (key) => async (req, res, next) => {
  if (!req.user?.clinic_id) return next(); // platform admin

  try {
    const cacheKey = `clinic:features:${req.user.clinic_id}`;
    let features = await cacheGet(cacheKey);

    if (!features) {
      const { rows } = await pool.query("SELECT features FROM clinics WHERE id = $1", [req.user.clinic_id]);
      features = rows[0]?.features || {};
      await cacheSet(cacheKey, features, STATUS_TTL);
    }

    if (!features[key]) {
      return res.status(403).json({ success: false, message: "This feature isn't included in your clinic's plan" });
    }
    next();
  } catch (err) {
    // Fail open on a cache/DB hiccup rather than locking everyone out.
    next();
  }
};
