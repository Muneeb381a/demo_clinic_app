// src/controllers/ipdBillingController.js
// Phase 3 hospital layer: advance deposits, ad-hoc doctor-visit/service
// charges logged during a stay, a live "running bill" preview (the interim
// bill), and a final IPD bill produced at discharge. The final bill is a row
// in the same bills/bill_items/payments tables Phase 1's OPD billing uses
// (kind='ipd', admission_id set) — billingController's getBill/listBills/
// addPayment/voidBill and the frontend receipt work on it unchanged.
//
// "Visit" charges are priced from the doctor's normal consultation_fee
// (doctor_fees) — Phase 1/2 don't have a separate IPD-visit fee field, and
// reusing the OPD fee keeps one number for the owner to maintain per doctor.

import { pool } from "../models/db.js";
import { toPaisa, fromPaisa, splitShare, billStatus } from "../utils/money.js";

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const clinicOf = (req) => req.user.clinic_id;
const METHODS = ["cash", "card", "online"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Standard hospital rounding: any part of a day counts as a full day, at
// least one day per stay segment even if discharged the same day.
const daysBetween = (from, to) => Math.max(1, Math.ceil((new Date(to) - new Date(from)) / MS_PER_DAY));

const loadAdmission = async (client, id, clinicId) => {
  const { rows } = await client.query("SELECT * FROM admissions WHERE id = $1 AND clinic_id = $2", [id, clinicId]);
  return rows[0];
};

const activeBillFor = async (client, admissionId) => {
  const { rows } = await client.query("SELECT * FROM bills WHERE admission_id = $1 AND status <> 'void'", [admissionId]);
  return rows[0] || null;
};

// ── Deposits ─────────────────────────────────────────────────────────────────

/** POST /api/ipd/admissions/:id/deposits — { amount, method?, reference? } */
export const addDeposit = async (req, res) => {
  const amount = Number(req.body.amount);
  const { method = "cash", reference = null } = req.body;
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, "amount must be greater than zero");
  if (!METHODS.includes(method)) return fail(res, 400, "Invalid payment method");
  try {
    const adm = await loadAdmission(pool, req.params.id, clinicOf(req));
    if (!adm) return fail(res, 404, "Admission not found");
    if (await activeBillFor(pool, adm.id)) return fail(res, 409, "This admission already has a bill — record payments on the bill instead");

    const { rows } = await pool.query(
      `INSERT INTO admission_deposits (clinic_id, admission_id, amount, method, reference, received_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [clinicOf(req), adm.id, amount, method, reference, req.user.id]
    );
    res.status(201).json({ success: true, deposit: rows[0] });
  } catch (e) {
    console.error("addDeposit error:", e.message);
    fail(res, 500, "Failed to record deposit");
  }
};

/** GET /api/ipd/admissions/:id/deposits */
export const listDeposits = async (req, res) => {
  try {
    const adm = await loadAdmission(pool, req.params.id, clinicOf(req));
    if (!adm) return fail(res, 404, "Admission not found");
    const { rows } = await pool.query("SELECT * FROM admission_deposits WHERE admission_id = $1 ORDER BY received_at", [adm.id]);
    res.json({ success: true, deposits: rows });
  } catch (e) {
    console.error("listDeposits error:", e.message);
    fail(res, 500, "Failed to load deposits");
  }
};

// ── Ad-hoc charges (doctor visits during the stay, services used) ───────────

/** POST /api/ipd/admissions/:id/charges — { type: 'visit'|'service', doctor_id? | service_id?, qty? } */
export const addCharge = async (req, res) => {
  const { type } = req.body;
  if (!["visit", "service"].includes(type)) return fail(res, 400, "type must be 'visit' or 'service'");
  try {
    const adm = await loadAdmission(pool, req.params.id, clinicOf(req));
    if (!adm) return fail(res, 404, "Admission not found");
    if (adm.status !== "admitted") return fail(res, 409, "Charges can only be added while the patient is admitted");
    if (await activeBillFor(pool, adm.id)) return fail(res, 409, "This admission already has a bill");

    let row;
    if (type === "visit") {
      const f = await pool.query(
        `SELECT f.*, u.name FROM doctor_fees f JOIN auth_users u ON u.id = f.doctor_id
          WHERE f.doctor_id = $1 AND f.clinic_id = $2`,
        [req.body.doctor_id, clinicOf(req)]
      );
      if (!f.rowCount) return fail(res, 400, "That doctor has no fee configured");
      const fee = f.rows[0];
      row = await pool.query(
        `INSERT INTO admission_charges (clinic_id, admission_id, kind, doctor_id, description, qty, unit_price, doctor_share_pct, created_by)
         VALUES ($1,$2,'visit',$3,$4,1,$5,$6,$7) RETURNING *`,
        [clinicOf(req), adm.id, fee.doctor_id, `Doctor visit — Dr. ${fee.name}`, fee.consultation_fee, fee.doctor_share_pct, req.user.id]
      );
    } else {
      const qty = Number.isInteger(req.body.qty) && req.body.qty > 0 ? req.body.qty : 1;
      const s = await pool.query("SELECT * FROM services WHERE id = $1 AND clinic_id = $2 AND active", [req.body.service_id, clinicOf(req)]);
      if (!s.rowCount) return fail(res, 400, "Service not found");
      row = await pool.query(
        `INSERT INTO admission_charges (clinic_id, admission_id, kind, service_id, description, qty, unit_price, created_by)
         VALUES ($1,$2,'service',$3,$4,$5,$6,$7) RETURNING *`,
        [clinicOf(req), adm.id, s.rows[0].id, s.rows[0].name, qty, s.rows[0].price, req.user.id]
      );
    }
    res.status(201).json({ success: true, charge: row.rows[0] });
  } catch (e) {
    console.error("addCharge error:", e.message);
    fail(res, 500, "Failed to add charge");
  }
};

/** GET /api/ipd/admissions/:id/charges */
export const listCharges = async (req, res) => {
  try {
    const adm = await loadAdmission(pool, req.params.id, clinicOf(req));
    if (!adm) return fail(res, 404, "Admission not found");
    const { rows } = await pool.query("SELECT * FROM admission_charges WHERE admission_id = $1 ORDER BY created_at", [adm.id]);
    res.json({ success: true, charges: rows });
  } catch (e) {
    console.error("listCharges error:", e.message);
    fail(res, 500, "Failed to load charges");
  }
};

/** DELETE /api/ipd/admissions/:id/charges/:chargeId — owner, only while unbilled. */
export const deleteCharge = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM admission_charges
        WHERE id = $1 AND admission_id = $2 AND clinic_id = $3 AND billed_item_id IS NULL RETURNING id`,
      [req.params.chargeId, req.params.id, clinicOf(req)]
    );
    if (!rows.length) return fail(res, 404, "Charge not found, or it has already been billed");
    res.json({ success: true });
  } catch (e) {
    console.error("deleteCharge error:", e.message);
    fail(res, 500, "Failed to delete charge");
  }
};

// ── Room rent + running total ───────────────────────────────────────────────

/** Room-rent line items priced from this admission's bed_stays (paisa). */
const roomRentLines = async (client, admissionId) => {
  const { rows } = await client.query(
    `SELECT s.from_at, s.to_at, s.daily_rate, b.bed_no, w.name AS ward_name
       FROM bed_stays s JOIN beds b ON b.id = s.bed_id JOIN wards w ON w.id = b.ward_id
      WHERE s.admission_id = $1 ORDER BY s.from_at`,
    [admissionId]
  );
  return rows.map((r) => {
    const days = daysBetween(r.from_at, r.to_at || new Date());
    const unit = toPaisa(r.daily_rate);
    return {
      kind: "room_rent", doctor_id: null, service_id: null, qty: days, unit,
      description: `Room rent — ${r.ward_name} / ${r.bed_no} (${days} day${days > 1 ? "s" : ""})`,
      doctorShare: 0, hospitalShare: unit * days,
    };
  });
};

const chargeLines = async (client, admissionId) => {
  const { rows } = await client.query("SELECT * FROM admission_charges WHERE admission_id = $1 ORDER BY created_at", [admissionId]);
  return rows.map((c) => {
    const unit = toPaisa(c.unit_price);
    const split = c.kind === "visit" ? splitShare(unit, c.doctor_share_pct) : { doctor: 0, hospital: unit * c.qty };
    return {
      kind: c.kind === "visit" ? "consultation" : "service", doctor_id: c.doctor_id, service_id: c.service_id,
      qty: c.qty, unit, description: c.description,
      doctorShare: split.doctor, hospitalShare: split.hospital,
      _sourceChargeId: c.id,
    };
  });
};

/** GET /api/ipd/admissions/:id/running-bill — live preview, printable as an interim statement. */
export const runningBill = async (req, res) => {
  try {
    const adm = await loadAdmission(pool, req.params.id, clinicOf(req));
    if (!adm) return fail(res, 404, "Admission not found");
    const [room, charges, deposits, bill] = await Promise.all([
      roomRentLines(pool, adm.id),
      chargeLines(pool, adm.id),
      pool.query("SELECT * FROM admission_deposits WHERE admission_id = $1 ORDER BY received_at", [adm.id]),
      activeBillFor(pool, adm.id),
    ]);
    const lines = [...room, ...charges].map(({ _sourceChargeId, ...l }) => l); // eslint-disable-line no-unused-vars
    const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const depositTotal = deposits.rows.reduce((s, d) => s + toPaisa(d.amount), 0);
    res.json({
      success: true,
      admission: adm,
      items: lines.map((l) => ({ ...l, unit_price: fromPaisa(l.unit), amount: fromPaisa(l.unit * l.qty), doctor_share_amount: fromPaisa(l.doctorShare), hospital_share_amount: fromPaisa(l.hospitalShare) })),
      subtotal: fromPaisa(subtotal),
      deposits: deposits.rows,
      deposit_total: fromPaisa(depositTotal),
      balance_so_far: fromPaisa(subtotal - depositTotal),
      finalized_bill_id: bill?.id || null,
    });
  } catch (e) {
    console.error("runningBill error:", e.message);
    fail(res, 500, "Failed to compute running bill");
  }
};

// ── Final bill at discharge ──────────────────────────────────────────────────

const nextIpdBillNo = async (client, clinicId) => {
  const r = await client.query(
    `INSERT INTO bill_counters (clinic_id, kind, last_no) VALUES ($1,'ipd',1)
     ON CONFLICT (clinic_id, kind) DO UPDATE SET last_no = bill_counters.last_no + 1 RETURNING last_no`,
    [clinicId]
  );
  return `IPD-${String(r.rows[0].last_no).padStart(6, "0")}`;
};

/**
 * POST /api/ipd/admissions/:id/bill — finalizes the IPD bill. Only once a
 * patient is discharged (so every bed_stay is closed); rejected if a
 * non-void bill already exists for this admission.
 * Body: { discount?, payment?: { amount, method?, reference? } }
 */
export const finalizeBill = async (req, res) => {
  const { discount = 0, payment } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const adm = await loadAdmission(client, req.params.id, clinicOf(req));
    if (!adm) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Admission not found");
    }
    if (adm.status !== "discharged") {
      await client.query("ROLLBACK");
      return fail(res, 409, "The patient must be discharged before finalizing the bill");
    }
    if (await activeBillFor(client, adm.id)) {
      await client.query("ROLLBACK");
      return fail(res, 409, "This admission already has a bill");
    }

    const room = await roomRentLines(client, adm.id);
    const charges = await chargeLines(client, adm.id);
    const lines = [...room, ...charges];
    if (lines.length === 0) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Nothing to bill");
    }
    const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const discountP = toPaisa(discount);
    if (discountP < 0 || discountP > subtotal) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Discount cannot exceed the subtotal");
    }
    const total = subtotal - discountP;

    const deposits = await client.query("SELECT * FROM admission_deposits WHERE admission_id = $1 AND applied_payment_id IS NULL", [adm.id]);
    const paidP = deposits.rows.reduce((s, d) => s + toPaisa(d.amount), 0);
    let extraP = 0;
    if (payment && Number(payment.amount) > 0) {
      if (payment.method && !METHODS.includes(payment.method)) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Invalid payment method");
      }
      extraP = toPaisa(payment.amount);
    }
    if (paidP + extraP > total) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Deposits plus payment exceed the bill total");
    }

    const billNo = await nextIpdBillNo(client, clinicOf(req));
    const bill = await client.query(
      `INSERT INTO bills (clinic_id, bill_no, kind, patient_id, admission_id, subtotal, discount, total, paid, status, created_by)
       VALUES ($1,$2,'ipd',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [clinicOf(req), billNo, adm.patient_id, adm.id, fromPaisa(subtotal), fromPaisa(discountP), fromPaisa(total),
       fromPaisa(paidP + extraP), billStatus(total, paidP + extraP), req.user.id]
    );
    const billId = bill.rows[0].id;

    for (const l of lines) {
      const item = await client.query(
        `INSERT INTO bill_items (bill_id, kind, doctor_id, service_id, description, qty, unit_price, amount, doctor_share_amount, hospital_share_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [billId, l.kind, l.doctor_id, l.service_id, l.description, l.qty, fromPaisa(l.unit), fromPaisa(l.unit * l.qty), fromPaisa(l.doctorShare), fromPaisa(l.hospitalShare)]
      );
      if (l._sourceChargeId) await client.query("UPDATE admission_charges SET billed_item_id = $1 WHERE id = $2", [item.rows[0].id, l._sourceChargeId]);
    }
    for (const d of deposits.rows) {
      const p = await client.query(
        "INSERT INTO payments (bill_id, amount, method, reference, received_by, received_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [billId, d.amount, d.method, d.reference ? `Deposit: ${d.reference}` : "Advance deposit", d.received_by, d.received_at]
      );
      await client.query("UPDATE admission_deposits SET applied_payment_id = $1 WHERE id = $2", [p.rows[0].id, d.id]);
    }
    if (extraP > 0) {
      await client.query(
        "INSERT INTO payments (bill_id, amount, method, reference, received_by) VALUES ($1,$2,$3,$4,$5)",
        [billId, fromPaisa(extraP), payment.method || "cash", payment.reference || null, req.user.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, bill: bill.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("finalizeBill error:", e.message);
    fail(res, 500, "Failed to finalize bill");
  } finally {
    client.release();
  }
};
