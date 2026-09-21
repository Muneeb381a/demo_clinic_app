// src/controllers/billingController.js
// Phase 1 hospital layer: doctor fees, services catalogue, OPD bills and
// payments. Every query is scoped to the caller's clinic. Totals and the
// doctor/hospital split are always computed here from stored fee/price rows —
// the client only says *what* was billed, never *how much*.

import { pool } from "../models/db.js";
import { toPaisa, fromPaisa, splitShare, billStatus } from "../utils/money.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const clinicOf = (req) => req.user.clinic_id;

// Platform admins have no clinic — nothing here applies to them.
export const requireClinicUser = (req, res, next) =>
  clinicOf(req) ? next() : fail(res, 403, "Billing is only available to clinic staff");

// ── Doctor fees ──────────────────────────────────────────────────────────────

/** GET /api/billing/doctors — clinic doctors joined with their fee row (if any). */
export const listDoctorFees = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS doctor_id, u.name, u.specialization,
              COALESCE(f.doctor_type, 'staff')          AS doctor_type,
              COALESCE(f.consultation_fee, 0)           AS consultation_fee,
              COALESCE(f.followup_fee, 0)               AS followup_fee,
              COALESCE(f.hospital_share_pct, 0)         AS hospital_share_pct,
              COALESCE(f.doctor_share_pct, 100)         AS doctor_share_pct,
              (f.id IS NOT NULL)                        AS configured
         FROM auth_users u
         LEFT JOIN doctor_fees f ON f.doctor_id = u.id AND f.clinic_id = u.clinic_id
        WHERE u.clinic_id = $1 AND u.role = 'doctor'
        ORDER BY u.name`,
      [clinicOf(req)]
    );
    res.json({ success: true, doctors: rows });
  } catch (e) {
    console.error("listDoctorFees error:", e.message);
    fail(res, 500, "Failed to load doctor fees");
  }
};

/** PUT /api/billing/doctors/:doctorId — owner only. */
export const upsertDoctorFee = async (req, res) => {
  const { doctorId } = req.params;
  const { doctor_type = "staff", consultation_fee, followup_fee = 0, hospital_share_pct, doctor_share_pct } = req.body;

  if (!["staff", "visiting"].includes(doctor_type)) return fail(res, 400, "doctor_type must be 'staff' or 'visiting'");
  const cFee = Number(consultation_fee);
  const fFee = Number(followup_fee);
  if (!Number.isFinite(cFee) || cFee < 0 || !Number.isFinite(fFee) || fFee < 0) {
    return fail(res, 400, "Fees must be zero or more");
  }
  // Staff doctors keep 100% by default; visiting doctors must state the split.
  const docPct = doctor_type === "staff" ? 100 : Number(doctor_share_pct);
  const hospPct = doctor_type === "staff" ? 0 : Number(hospital_share_pct);
  if (!Number.isFinite(docPct) || !Number.isFinite(hospPct) || docPct < 0 || hospPct < 0 || Math.abs(docPct + hospPct - 100) > 0.001) {
    return fail(res, 400, "hospital_share_pct and doctor_share_pct must add up to 100");
  }

  try {
    const doc = await pool.query("SELECT 1 FROM auth_users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor'", [doctorId, clinicOf(req)]);
    if (!doc.rowCount) return fail(res, 404, "Doctor not found");

    const { rows } = await pool.query(
      `INSERT INTO doctor_fees (clinic_id, doctor_id, doctor_type, consultation_fee, followup_fee, hospital_share_pct, doctor_share_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (clinic_id, doctor_id) DO UPDATE SET
         doctor_type = EXCLUDED.doctor_type, consultation_fee = EXCLUDED.consultation_fee,
         followup_fee = EXCLUDED.followup_fee, hospital_share_pct = EXCLUDED.hospital_share_pct,
         doctor_share_pct = EXCLUDED.doctor_share_pct
       RETURNING *`,
      [clinicOf(req), doctorId, doctor_type, cFee, fFee, hospPct, docPct]
    );
    res.json({ success: true, fee: rows[0] });
  } catch (e) {
    console.error("upsertDoctorFee error:", e.message);
    fail(res, 500, "Failed to save doctor fee");
  }
};

// ── Services catalogue ───────────────────────────────────────────────────────

export const listServices = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM services WHERE clinic_id = $1 ORDER BY active DESC, category, name",
      [clinicOf(req)]
    );
    res.json({ success: true, services: rows });
  } catch (e) {
    console.error("listServices error:", e.message);
    fail(res, 500, "Failed to load services");
  }
};

const validService = ({ name, category = "other", price }) => {
  if (!name || !String(name).trim()) return "name is required";
  if (!["procedure", "lab", "radiology", "other"].includes(category)) return "invalid category";
  const p = Number(price);
  if (!Number.isFinite(p) || p < 0) return "price must be zero or more";
  return null;
};

export const createService = async (req, res) => {
  const err = validService(req.body);
  if (err) return fail(res, 400, err);
  try {
    const { name, category = "other", price } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO services (clinic_id, name, category, price) VALUES ($1,$2,$3,$4) RETURNING *",
      [clinicOf(req), String(name).trim(), category, Number(price)]
    );
    res.status(201).json({ success: true, service: rows[0] });
  } catch (e) {
    console.error("createService error:", e.message);
    fail(res, 500, "Failed to create service");
  }
};

export const updateService = async (req, res) => {
  const err = validService(req.body);
  if (err) return fail(res, 400, err);
  try {
    const { name, category = "other", price, active = true } = req.body;
    const { rows } = await pool.query(
      `UPDATE services SET name=$1, category=$2, price=$3, active=$4
        WHERE id=$5 AND clinic_id=$6 RETURNING *`,
      [String(name).trim(), category, Number(price), Boolean(active), req.params.id, clinicOf(req)]
    );
    if (!rows.length) return fail(res, 404, "Service not found");
    res.json({ success: true, service: rows[0] });
  } catch (e) {
    console.error("updateService error:", e.message);
    fail(res, 500, "Failed to update service");
  }
};

// ── Bills ────────────────────────────────────────────────────────────────────

const METHODS = ["cash", "card", "online"];

/**
 * POST /api/billing/bills
 * Body: { patient_id, consultation_id?, items: [{ type: 'consultation'|'followup',
 *   doctor_id } | { type: 'service', service_id, qty? }], discount?,
 *   payment?: { amount, method?, reference? } }
 */
export const createBill = async (req, res) => {
  const { patient_id, consultation_id = null, items, discount = 0, payment } = req.body;
  if (!patient_id) return fail(res, 400, "patient_id is required");
  if (!Array.isArray(items) || items.length === 0) return fail(res, 400, "At least one item is required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pat = await client.query("SELECT 1 FROM patients WHERE id = $1 AND clinic_id = $2", [patient_id, clinicOf(req)]);
    if (!pat.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Patient not found");
    }
    if (consultation_id) {
      const c = await client.query(
        `SELECT 1 FROM consultations c JOIN patients p ON p.id = c.patient_id
          WHERE c.id = $1 AND p.id = $2 AND p.clinic_id = $3`,
        [consultation_id, patient_id, clinicOf(req)]
      );
      if (!c.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Consultation not found");
      }
    }

    // Resolve every line from stored rows — never from client-sent prices.
    const lines = [];
    for (const it of items) {
      if (it.type === "consultation" || it.type === "followup") {
        const f = await client.query(
          `SELECT f.*, u.name FROM doctor_fees f JOIN auth_users u ON u.id = f.doctor_id
            WHERE f.doctor_id = $1 AND f.clinic_id = $2`,
          [it.doctor_id, clinicOf(req)]
        );
        if (!f.rowCount) {
          await client.query("ROLLBACK");
          return fail(res, 400, "That doctor has no fee configured");
        }
        const fee = f.rows[0];
        const unit = toPaisa(it.type === "followup" ? fee.followup_fee : fee.consultation_fee);
        const split = splitShare(unit, fee.doctor_share_pct);
        lines.push({
          kind: it.type, doctor_id: fee.doctor_id, service_id: null, qty: 1, unit,
          description: `${it.type === "followup" ? "Follow-up" : "Consultation"} — Dr. ${fee.name}`,
          doctorShare: split.doctor, hospitalShare: split.hospital,
        });
      } else if (it.type === "service") {
        const qty = Number.isInteger(it.qty) && it.qty > 0 ? it.qty : 1;
        const s = await client.query("SELECT * FROM services WHERE id = $1 AND clinic_id = $2 AND active", [it.service_id, clinicOf(req)]);
        if (!s.rowCount) {
          await client.query("ROLLBACK");
          return fail(res, 400, "Service not found");
        }
        const unit = toPaisa(s.rows[0].price);
        lines.push({
          kind: "service", doctor_id: null, service_id: s.rows[0].id, qty, unit,
          description: s.rows[0].name, doctorShare: 0, hospitalShare: unit * qty,
        });
      } else {
        await client.query("ROLLBACK");
        return fail(res, 400, "Unknown item type");
      }
    }

    const subtotal = lines.reduce((sum, l) => sum + l.unit * l.qty, 0);
    const discountP = toPaisa(discount);
    if (discountP < 0 || discountP > subtotal) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Discount cannot exceed the subtotal");
    }
    const total = subtotal - discountP;

    let payP = 0;
    if (payment && Number(payment.amount) > 0) {
      payP = toPaisa(payment.amount);
      if (payP > total) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Payment exceeds the bill total");
      }
      if (payment.method && !METHODS.includes(payment.method)) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Invalid payment method");
      }
    }

    // Gap-free per-clinic number, held by the row lock until COMMIT.
    const ctr = await client.query(
      `INSERT INTO bill_counters (clinic_id, kind, last_no) VALUES ($1,'opd',1)
       ON CONFLICT (clinic_id, kind) DO UPDATE SET last_no = bill_counters.last_no + 1
       RETURNING last_no`,
      [clinicOf(req)]
    );
    const billNo = `OPD-${String(ctr.rows[0].last_no).padStart(6, "0")}`;

    const bill = await client.query(
      `INSERT INTO bills (clinic_id, bill_no, kind, patient_id, consultation_id, subtotal, discount, total, paid, status, created_by)
       VALUES ($1,$2,'opd',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [clinicOf(req), billNo, patient_id, consultation_id, fromPaisa(subtotal), fromPaisa(discountP),
       fromPaisa(total), fromPaisa(payP), billStatus(total, payP), req.user.id]
    );
    const billId = bill.rows[0].id;

    // Phase 1 rule: doctor/hospital shares are computed on the pre-discount
    // line price, so a discount is absorbed by the hospital's side and a
    // visiting doctor's payout never shrinks because of it.
    for (const l of lines) {
      await client.query(
        `INSERT INTO bill_items (bill_id, kind, doctor_id, service_id, description, qty, unit_price, amount, doctor_share_amount, hospital_share_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [billId, l.kind, l.doctor_id, l.service_id, l.description, l.qty, fromPaisa(l.unit),
         fromPaisa(l.unit * l.qty), fromPaisa(l.doctorShare), fromPaisa(l.hospitalShare)]
      );
    }
    if (payP > 0) {
      await client.query(
        "INSERT INTO payments (bill_id, amount, method, reference, received_by) VALUES ($1,$2,$3,$4,$5)",
        [billId, fromPaisa(payP), payment.method || "cash", payment.reference || null, req.user.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, bill: bill.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("createBill error:", e.message);
    fail(res, 500, "Failed to create bill");
  } finally {
    client.release();
  }
};

/** GET /api/billing/bills?status=&patient_id=&limit= */
export const listBills = async (req, res) => {
  try {
    const params = [clinicOf(req)];
    let where = "b.clinic_id = $1";
    if (req.query.status) { params.push(req.query.status); where += ` AND b.status = $${params.length}`; }
    if (req.query.patient_id) { params.push(req.query.patient_id); where += ` AND b.patient_id = $${params.length}`; }
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `SELECT b.*, p.name AS patient_name, p.mobile
         FROM bills b JOIN patients p ON p.id = b.patient_id
        WHERE ${where} ORDER BY b.created_at DESC LIMIT ${limit}`,
      params
    );
    res.json({ success: true, bills: rows });
  } catch (e) {
    console.error("listBills error:", e.message);
    fail(res, 500, "Failed to load bills");
  }
};

/** GET /api/billing/bills/:id — bill + items + payments (also the receipt payload). */
export const getBill = async (req, res) => {
  try {
    const b = await pool.query(
      `SELECT b.*, p.name AS patient_name, p.mobile, p.mr_no, c.name AS clinic_name,
              u.name AS created_by_name
         FROM bills b JOIN patients p ON p.id = b.patient_id
         JOIN clinics c ON c.id = b.clinic_id
         LEFT JOIN auth_users u ON u.id = b.created_by
        WHERE b.id = $1 AND b.clinic_id = $2`,
      [req.params.id, clinicOf(req)]
    );
    if (!b.rowCount) return fail(res, 404, "Bill not found");
    const items = await pool.query("SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id", [req.params.id]);
    const pays = await pool.query("SELECT * FROM payments WHERE bill_id = $1 ORDER BY received_at", [req.params.id]);
    res.json({ success: true, bill: b.rows[0], items: items.rows, payments: pays.rows });
  } catch (e) {
    console.error("getBill error:", e.message);
    fail(res, 500, "Failed to load bill");
  }
};

/** POST /api/billing/bills/:id/payments — body { amount, method?, reference? } */
export const addPayment = async (req, res) => {
  const amount = Number(req.body.amount);
  const { method = "cash", reference = null } = req.body;
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, "amount must be greater than zero");
  if (!METHODS.includes(method)) return fail(res, 400, "Invalid payment method");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const b = await client.query("SELECT * FROM bills WHERE id = $1 AND clinic_id = $2 FOR UPDATE", [req.params.id, clinicOf(req)]);
    if (!b.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Bill not found");
    }
    const bill = b.rows[0];
    if (bill.status === "void") {
      await client.query("ROLLBACK");
      return fail(res, 409, "This bill is void");
    }
    const totalP = toPaisa(bill.total);
    const newPaid = toPaisa(bill.paid) + toPaisa(amount);
    if (newPaid > totalP) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Payment exceeds the remaining balance");
    }
    await client.query(
      "INSERT INTO payments (bill_id, amount, method, reference, received_by) VALUES ($1,$2,$3,$4,$5)",
      [bill.id, amount, method, reference, req.user.id]
    );
    const upd = await client.query(
      "UPDATE bills SET paid = $1, status = $2 WHERE id = $3 RETURNING *",
      [fromPaisa(newPaid), billStatus(totalP, newPaid), bill.id]
    );
    await client.query("COMMIT");
    res.status(201).json({ success: true, bill: upd.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("addPayment error:", e.message);
    fail(res, 500, "Failed to record payment");
  } finally {
    client.release();
  }
};

/** POST /api/billing/bills/:id/void — owner only. Keeps the row for audit. */
export const voidBill = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE bills SET status = 'void', voided_at = NOW()
        WHERE id = $1 AND clinic_id = $2 AND status <> 'void' RETURNING *`,
      [req.params.id, clinicOf(req)]
    );
    if (!rows.length) return fail(res, 404, "Bill not found or already void");
    res.json({ success: true, bill: rows[0] });
  } catch (e) {
    console.error("voidBill error:", e.message);
    fail(res, 500, "Failed to void bill");
  }
};

/** GET /api/billing/summary/today — collection for the dashboard card. */
export const todaySummary = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(pay.amount),0) AS collected, COUNT(DISTINCT pay.bill_id) AS bills
         FROM payments pay JOIN bills b ON b.id = pay.bill_id
        WHERE b.clinic_id = $1 AND b.status <> 'void' AND pay.received_at >= date_trunc('day', NOW())`,
      [clinicOf(req)]
    );
    res.json({ success: true, collected: rows[0].collected, bills: Number(rows[0].bills) });
  } catch (e) {
    console.error("todaySummary error:", e.message);
    fail(res, 500, "Failed to load summary");
  }
};
