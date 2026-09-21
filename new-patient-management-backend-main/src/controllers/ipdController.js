// src/controllers/ipdController.js
// Phase 2 hospital layer: wards, beds, admissions, transfers, discharge.
// Everything is clinic-scoped. Bed state changes happen inside transactions
// that lock the bed row, so two receptionists can't admit into one bed.

import { pool } from "../models/db.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const clinicOf = (req) => req.user.clinic_id;

export const requireClinicUser = (req, res, next) =>
  clinicOf(req) ? next() : fail(res, 403, "Inpatient management is only available to clinic staff");

const WARD_TYPES = ["general", "semi_private", "private", "icu", "ccu", "nicu", "other"];

/** GET /api/ipd/doctors — the clinic's doctors, for the attending-doctor picker. */
export const listDoctors = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id AS doctor_id, name FROM auth_users WHERE clinic_id = $1 AND role = 'doctor' ORDER BY name", [clinicOf(req)]);
    res.json({ success: true, doctors: rows });
  } catch (e) {
    console.error("listDoctors error:", e.message);
    fail(res, 500, "Failed to load doctors");
  }
};

// ── Wards & beds (owner sets up, staff can read) ─────────────────────────────

export const listWards = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, COUNT(b.id) FILTER (WHERE b.active) AS bed_count
         FROM wards w LEFT JOIN beds b ON b.ward_id = w.id
        WHERE w.clinic_id = $1 GROUP BY w.id ORDER BY w.name`,
      [clinicOf(req)]
    );
    res.json({ success: true, wards: rows });
  } catch (e) {
    console.error("listWards error:", e.message);
    fail(res, 500, "Failed to load wards");
  }
};

const validWard = ({ name, ward_type = "general", daily_rate }) => {
  if (!name || !String(name).trim()) return "name is required";
  if (!WARD_TYPES.includes(ward_type)) return "invalid ward_type";
  const r = Number(daily_rate);
  if (!Number.isFinite(r) || r < 0) return "daily_rate must be zero or more";
  return null;
};

export const createWard = async (req, res) => {
  const err = validWard(req.body);
  if (err) return fail(res, 400, err);
  try {
    const { name, ward_type = "general", daily_rate } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO wards (clinic_id, name, ward_type, daily_rate) VALUES ($1,$2,$3,$4) RETURNING *",
      [clinicOf(req), String(name).trim(), ward_type, Number(daily_rate)]
    );
    res.status(201).json({ success: true, ward: rows[0] });
  } catch (e) {
    if (e.code === "23505") return fail(res, 409, "A ward with that name already exists");
    console.error("createWard error:", e.message);
    fail(res, 500, "Failed to create ward");
  }
};

export const updateWard = async (req, res) => {
  const err = validWard(req.body);
  if (err) return fail(res, 400, err);
  try {
    const { name, ward_type = "general", daily_rate, active = true } = req.body;
    const { rows } = await pool.query(
      `UPDATE wards SET name=$1, ward_type=$2, daily_rate=$3, active=$4
        WHERE id=$5 AND clinic_id=$6 RETURNING *`,
      [String(name).trim(), ward_type, Number(daily_rate), Boolean(active), req.params.id, clinicOf(req)]
    );
    if (!rows.length) return fail(res, 404, "Ward not found");
    res.json({ success: true, ward: rows[0] });
  } catch (e) {
    if (e.code === "23505") return fail(res, 409, "A ward with that name already exists");
    console.error("updateWard error:", e.message);
    fail(res, 500, "Failed to update ward");
  }
};

/** POST /api/ipd/wards/:id/beds — { count, prefix? } creates prefix+N, continuing the numbering. */
export const addBeds = async (req, res) => {
  const count = Number(req.body.count);
  const prefix = String(req.body.prefix ?? "").trim().slice(0, 20);
  if (!Number.isInteger(count) || count < 1 || count > 100) return fail(res, 400, "count must be between 1 and 100");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const w = await client.query("SELECT id FROM wards WHERE id = $1 AND clinic_id = $2 FOR UPDATE", [req.params.id, clinicOf(req)]);
    if (!w.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Ward not found");
    }
    const existing = await client.query("SELECT COUNT(*)::int AS n FROM beds WHERE ward_id = $1", [req.params.id]);
    const start = existing.rows[0].n;
    const created = [];
    for (let i = 1; i <= count; i++) {
      const r = await client.query(
        "INSERT INTO beds (clinic_id, ward_id, bed_no) VALUES ($1,$2,$3) ON CONFLICT (ward_id, bed_no) DO NOTHING RETURNING *",
        [clinicOf(req), req.params.id, `${prefix}${start + i}`]
      );
      if (r.rows[0]) created.push(r.rows[0]);
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, beds: created });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("addBeds error:", e.message);
    fail(res, 500, "Failed to add beds");
  } finally {
    client.release();
  }
};

/** PUT /api/ipd/beds/:id — owner: { daily_rate_override?, active? }; not while occupied. */
export const updateBed = async (req, res) => {
  try {
    const { daily_rate_override = null, active = true } = req.body;
    if (daily_rate_override !== null && !(Number(daily_rate_override) >= 0)) return fail(res, 400, "Invalid rate");
    const { rows } = await pool.query(
      `UPDATE beds SET daily_rate_override = $1, active = $2
        WHERE id = $3 AND clinic_id = $4 AND status <> 'occupied' RETURNING *`,
      [daily_rate_override === null ? null : Number(daily_rate_override), Boolean(active), req.params.id, clinicOf(req)]
    );
    if (!rows.length) return fail(res, 404, "Bed not found, or it is occupied");
    res.json({ success: true, bed: rows[0] });
  } catch (e) {
    console.error("updateBed error:", e.message);
    fail(res, 500, "Failed to update bed");
  }
};

/** PUT /api/ipd/beds/:id/status — staff: available | cleaning | maintenance (never "occupied" by hand). */
export const setBedStatus = async (req, res) => {
  const { status } = req.body;
  if (!["available", "cleaning", "maintenance"].includes(status)) return fail(res, 400, "Invalid status");
  try {
    const { rows } = await pool.query(
      "UPDATE beds SET status = $1 WHERE id = $2 AND clinic_id = $3 AND status <> 'occupied' RETURNING *",
      [status, req.params.id, clinicOf(req)]
    );
    if (!rows.length) return fail(res, 404, "Bed not found, or it is occupied");
    res.json({ success: true, bed: rows[0] });
  } catch (e) {
    console.error("setBedStatus error:", e.message);
    fail(res, 500, "Failed to update bed");
  }
};

/** GET /api/ipd/beds — the bed board: every bed with its ward and current patient. */
export const bedBoard = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.bed_no, b.status, b.ward_id, w.name AS ward_name, w.ward_type,
              COALESCE(b.daily_rate_override, w.daily_rate) AS daily_rate,
              a.id AS admission_id, a.admission_no, p.name AS patient_name, a.admitted_at
         FROM beds b JOIN wards w ON w.id = b.ward_id
         LEFT JOIN bed_stays s ON s.bed_id = b.id AND s.to_at IS NULL
         LEFT JOIN admissions a ON a.id = s.admission_id
         LEFT JOIN patients p ON p.id = a.patient_id
        WHERE b.clinic_id = $1 AND b.active AND w.active
        ORDER BY w.name, b.id`,
      [clinicOf(req)]
    );
    const counts = { total: rows.length, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
    for (const r of rows) counts[r.status] += 1;
    res.json({ success: true, beds: rows, counts });
  } catch (e) {
    console.error("bedBoard error:", e.message);
    fail(res, 500, "Failed to load beds");
  }
};

// ── Admissions ───────────────────────────────────────────────────────────────

const nextAdmissionNo = async (client, clinicId) => {
  const r = await client.query(
    `INSERT INTO bill_counters (clinic_id, kind, last_no) VALUES ($1,'adm',1)
     ON CONFLICT (clinic_id, kind) DO UPDATE SET last_no = bill_counters.last_no + 1 RETURNING last_no`,
    [clinicId]
  );
  return `ADM-${String(r.rows[0].last_no).padStart(6, "0")}`;
};

/** Lock a bed, require it free, and open a stay on it at the bed's current daily rate. */
const occupyBed = async (client, clinicId, bedId, admissionId) => {
  const b = await client.query(
    `SELECT b.status, COALESCE(b.daily_rate_override, w.daily_rate) AS rate
       FROM beds b JOIN wards w ON w.id = b.ward_id
      WHERE b.id = $1 AND b.clinic_id = $2 AND b.active AND w.active FOR UPDATE OF b`,
    [bedId, clinicId]
  );
  if (!b.rowCount) return { error: [404, "Bed not found"] };
  if (b.rows[0].status !== "available") return { error: [409, `That bed is ${b.rows[0].status}`] };
  await client.query("INSERT INTO bed_stays (admission_id, bed_id, daily_rate) VALUES ($1,$2,$3)", [admissionId, bedId, b.rows[0].rate]);
  await client.query("UPDATE beds SET status = 'occupied' WHERE id = $1", [bedId]);
  return { ok: true };
};

/** POST /api/ipd/admissions — { patient_id, bed_id, doctor_id?, diagnosis? } */
export const admitPatient = async (req, res) => {
  const { patient_id, bed_id, doctor_id = null, diagnosis = null } = req.body;
  if (!patient_id || !bed_id) return fail(res, 400, "patient_id and bed_id are required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pat = await client.query("SELECT 1 FROM patients WHERE id = $1 AND clinic_id = $2", [patient_id, clinicOf(req)]);
    if (!pat.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Patient not found");
    }
    if (doctor_id) {
      const d = await client.query("SELECT 1 FROM auth_users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'", [doctor_id, clinicOf(req)]);
      if (!d.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Doctor not found");
      }
    }
    const active = await client.query("SELECT admission_no FROM admissions WHERE patient_id = $1 AND status = 'admitted'", [patient_id]);
    if (active.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 409, `Patient is already admitted (${active.rows[0].admission_no})`);
    }
    const no = await nextAdmissionNo(client, clinicOf(req));
    const adm = await client.query(
      `INSERT INTO admissions (clinic_id, admission_no, patient_id, doctor_id, diagnosis, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [clinicOf(req), no, patient_id, doctor_id, diagnosis, req.user.id]
    );
    const occ = await occupyBed(client, clinicOf(req), bed_id, adm.rows[0].id);
    if (occ.error) {
      await client.query("ROLLBACK");
      return fail(res, occ.error[0], occ.error[1]);
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, admission: adm.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (e.code === "23505") return fail(res, 409, "That patient or bed was just taken — refresh and retry");
    console.error("admitPatient error:", e.message);
    fail(res, 500, "Failed to admit patient");
  } finally {
    client.release();
  }
};

const lockAdmission = async (client, id, clinicId) => {
  const a = await client.query("SELECT * FROM admissions WHERE id = $1 AND clinic_id = $2 FOR UPDATE", [id, clinicId]);
  return a.rows[0];
};

/** POST /api/ipd/admissions/:id/transfer — { bed_id } */
export const transferPatient = async (req, res) => {
  const { bed_id } = req.body;
  if (!bed_id) return fail(res, 400, "bed_id is required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const adm = await lockAdmission(client, req.params.id, clinicOf(req));
    if (!adm) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Admission not found");
    }
    if (adm.status !== "admitted") {
      await client.query("ROLLBACK");
      return fail(res, 409, "Patient is already discharged");
    }
    const cur = await client.query("SELECT bed_id FROM bed_stays WHERE admission_id = $1 AND to_at IS NULL", [adm.id]);
    if (cur.rows[0]?.bed_id === Number(bed_id)) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Patient is already in that bed");
    }
    // Close the old stay first so the one-open-stay-per-bed index never trips.
    await client.query("UPDATE bed_stays SET to_at = NOW() WHERE admission_id = $1 AND to_at IS NULL", [adm.id]);
    const occ = await occupyBed(client, clinicOf(req), bed_id, adm.id);
    if (occ.error) {
      await client.query("ROLLBACK");
      return fail(res, occ.error[0], occ.error[1]);
    }
    await client.query("UPDATE beds SET status = 'cleaning' WHERE id = $1", [cur.rows[0].bed_id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("transferPatient error:", e.message);
    fail(res, 500, "Failed to transfer patient");
  } finally {
    client.release();
  }
};

/** POST /api/ipd/admissions/:id/discharge — { discharge_summary? } */
export const dischargePatient = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const adm = await lockAdmission(client, req.params.id, clinicOf(req));
    if (!adm) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Admission not found");
    }
    if (adm.status !== "admitted") {
      await client.query("ROLLBACK");
      return fail(res, 409, "Patient is already discharged");
    }
    const stay = await client.query(
      "UPDATE bed_stays SET to_at = NOW() WHERE admission_id = $1 AND to_at IS NULL RETURNING bed_id", [adm.id]
    );
    if (stay.rows[0]) await client.query("UPDATE beds SET status = 'cleaning' WHERE id = $1", [stay.rows[0].bed_id]);
    const upd = await client.query(
      `UPDATE admissions SET status = 'discharged', discharged_at = NOW(), discharge_summary = $2
        WHERE id = $1 RETURNING *`,
      [adm.id, req.body.discharge_summary || null]
    );
    await client.query("COMMIT");
    res.json({ success: true, admission: upd.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("dischargePatient error:", e.message);
    fail(res, 500, "Failed to discharge patient");
  } finally {
    client.release();
  }
};

/** GET /api/ipd/admissions?status=admitted|discharged */
export const listAdmissions = async (req, res) => {
  try {
    const params = [clinicOf(req)];
    let where = "a.clinic_id = $1";
    if (["admitted", "discharged"].includes(req.query.status)) {
      params.push(req.query.status);
      where += ` AND a.status = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT a.*, p.name AS patient_name, p.mobile, u.name AS doctor_name,
              b.id AS bed_id, b.bed_no, w.name AS ward_name
         FROM admissions a JOIN patients p ON p.id = a.patient_id
         LEFT JOIN auth_users u ON u.id = a.doctor_id
         LEFT JOIN bed_stays s ON s.admission_id = a.id AND s.to_at IS NULL
         LEFT JOIN beds b ON b.id = s.bed_id LEFT JOIN wards w ON w.id = b.ward_id
        WHERE ${where} ORDER BY a.admitted_at DESC LIMIT 200`,
      params
    );
    res.json({ success: true, admissions: rows });
  } catch (e) {
    console.error("listAdmissions error:", e.message);
    fail(res, 500, "Failed to load admissions");
  }
};

/** GET /api/ipd/admissions/:id — with the full bed-stay history. */
export const getAdmission = async (req, res) => {
  try {
    const a = await pool.query(
      `SELECT a.*, p.name AS patient_name, p.mobile, u.name AS doctor_name
         FROM admissions a JOIN patients p ON p.id = a.patient_id
         LEFT JOIN auth_users u ON u.id = a.doctor_id
        WHERE a.id = $1 AND a.clinic_id = $2`,
      [req.params.id, clinicOf(req)]
    );
    if (!a.rowCount) return fail(res, 404, "Admission not found");
    const stays = await pool.query(
      `SELECT s.*, b.bed_no, w.name AS ward_name FROM bed_stays s
         JOIN beds b ON b.id = s.bed_id JOIN wards w ON w.id = b.ward_id
        WHERE s.admission_id = $1 ORDER BY s.from_at`,
      [req.params.id]
    );
    res.json({ success: true, admission: a.rows[0], stays: stays.rows });
  } catch (e) {
    console.error("getAdmission error:", e.message);
    fail(res, 500, "Failed to load admission");
  }
};
