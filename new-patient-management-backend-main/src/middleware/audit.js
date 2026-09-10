// src/middleware/audit.js
// Records an audit_log row for every mutation and for reads of sensitive
// records. Fire-and-forget on response `finish` so it never adds latency or
// fails a request; a write error is logged and swallowed.

import { pool } from "../models/db.js";
import { logger } from "../lib/logger.js";

const asInet = (v) =>
  typeof v === "string" && /^[0-9a-fA-F:.]+$/.test(v) && v.length <= 45 ? v : null;

// GET paths worth trailing (record access, not just change). Matched against
// req.baseUrl + req.route.path style — we test the original URL instead.
const SENSITIVE_GET = [
  /^\/api\/patients\/\d+(\/|$)/,
  /^\/api\/patient-history\/\d+/,
  /^\/api\/patients\/\d+\/consultations\/\d+/,
  /^\/api\/consultations\/\d+(\/|$)/,
  /^\/api\/prescriptions\/(patient|consultation)\//,
];

// Best-effort entity extraction straight from the URL path — req.params has
// already been unwound by the time the `finish` handler runs.
const entityFrom = (path) => {
  let m;
  if ((m = path.match(/\/consultations?\/(\d+)/))) return { entity_type: "consultation", entity_id: m[1] };
  if ((m = path.match(/\/patient-history\/(\d+)/))) return { entity_type: "patient", entity_id: m[1] };
  if ((m = path.match(/\/patients?\/(\d+)/))) return { entity_type: "patient", entity_id: m[1] };
  if ((m = path.match(/\/prescriptions?\/(?:patient|consultation)\/(\d+)/)))
    return { entity_type: "prescription", entity_id: m[1] };
  if (/\/prescriptions?\b/.test(path)) return { entity_type: "prescription", entity_id: null };
  return { entity_type: null, entity_id: null };
};

const shouldAudit = (req) => {
  if (req.method !== "GET") return true;
  return SENSITIVE_GET.some((re) => re.test(req.originalUrl));
};

export const audit = (req, res, next) => {
  if (!shouldAudit(req)) return next();

  const path = req.originalUrl.split("?")[0];
  const query = { ...req.query };
  const method = req.method;

  res.on("finish", () => {
    // Skip failed auth — nothing meaningful accessed.
    if (res.statusCode === 401) return;

    const { entity_type, entity_id } = entityFrom(path);
    pool
      .query(
        `INSERT INTO audit_log
           (user_id, action, path, entity_type, entity_id, status, ip, user_agent, metadata, request_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          req.user?.id ?? null,
          method,
          path.slice(0, 500),
          entity_type,
          entity_id,
          res.statusCode,
          asInet(req.ip),
          (req.headers["user-agent"] || "").slice(0, 500),
          JSON.stringify({ query }),
          req.id ?? null,
        ]
      )
      .catch((err) => logger.warn("audit write failed", { error: err.message, path }));
  });

  next();
};
