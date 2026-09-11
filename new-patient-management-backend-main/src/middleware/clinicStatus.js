// src/middleware/clinicStatus.js
// Blocks every request from a suspended clinic's staff. Platform admins have
// no clinic_id and are unaffected. Status is cached briefly (it changes only
// when a platform admin calls PATCH /api/platform/clinics/:id, which
// invalidates this key) so normal traffic doesn't add a DB round-trip.

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
