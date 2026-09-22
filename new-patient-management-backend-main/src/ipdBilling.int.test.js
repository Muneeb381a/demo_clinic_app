// Integration test: IPD deposits, ad-hoc charges, running bill, final bill
// (Phase 3 hospital layer). Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("ipd billing (integration)", () => {
  let request, app, pool, signToken;
  const ids = { clinics: [], users: [], patients: [] };
  let A, ownerTok, recepTok, otherTok, docId, patId, wardId, bedId;
  const ts = Date.now();

  const mkUser = async (name, role, clinicId, isOwner = false) => {
    const r = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ($1,$2,'x','',$3,$4,$5) RETURNING id`,
      [name, `${name}-${ts}-${Math.random().toString(36).slice(2, 6)}@t.pk`, role, clinicId, isOwner]
    );
    ids.users.push(r.rows[0].id);
    return r.rows[0].id;
  };
  const tok = (id, role, clinic, owner = false) => signToken({ id, email: "x@t.pk", role, clinic_id: clinic, is_owner: owner });
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  // Backdate a bed_stay's from_at so room-rent math is deterministic in tests
  // (real stays would otherwise all be "today", i.e. 1 day, which under-tests
  // the day-count math).
  const backdateStay = (admissionId, days) =>
    pool.query("UPDATE bed_stays SET from_at = NOW() - ($2 || ' days')::interval WHERE admission_id = $1 AND to_at IS NULL", [admissionId, days]);

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "u".repeat(48);
    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    const c = await pool.query("INSERT INTO clinics (name, slug, features) VALUES ($1,$2,$3) RETURNING id", ["ipdb", `ipdb-${ts}`, JSON.stringify({ ipd: true, billing: true })]);
    A = c.rows[0].id;
    ids.clinics.push(A);
    const other = await pool.query("INSERT INTO clinics (name, slug, features) VALUES ($1,$2,$3) RETURNING id", ["ipdb-other", `ipdb-other-${ts}`, JSON.stringify({ ipd: true })]);
    ids.clinics.push(other.rows[0].id);

    const owner = await mkUser("owner", "doctor", A, true);
    docId = owner;
    const recep = await mkUser("recep", "receptionist", A);
    const otherOwner = await mkUser("otherowner", "doctor", other.rows[0].id, true);
    ownerTok = tok(owner, "doctor", A, true);
    recepTok = tok(recep, "receptionist", A);
    otherTok = tok(otherOwner, "doctor", other.rows[0].id, true);

    const p = await pool.query("INSERT INTO patients (name, mobile, mr_no, clinic_id, doctor_id) VALUES ('Pat','03001234567',$1,$2,$3) RETURNING id", [`MR-${ts}`, A, owner]);
    patId = p.rows[0].id;
    ids.patients.push(patId);

    await pool.query(
      `INSERT INTO doctor_fees (clinic_id, doctor_id, doctor_type, consultation_fee, hospital_share_pct, doctor_share_pct)
       VALUES ($1,$2,'visiting',1000,30,70)`,
      [A, owner]
    );
    const svc = await pool.query("INSERT INTO services (clinic_id, name, price) VALUES ($1,'ECG',500) RETURNING id", [A]);

    const w = await request(app).post("/api/ipd/wards").set(auth(ownerTok)).send({ name: "General", daily_rate: 2000 });
    wardId = w.body.ward.id;
    const beds = await request(app).post(`/api/ipd/wards/${wardId}/beds`).set(auth(ownerTok)).send({ count: 1, prefix: "G-" });
    bedId = beds.body.beds[0].id;

    ids._serviceId = svc.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    // admission_deposits.applied_payment_id references payments — clear it first.
    await pool.query("DELETE FROM admission_deposits WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM admission_charges WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM payments WHERE bill_id IN (SELECT id FROM bills WHERE clinic_id = ANY($1))", [ids.clinics]);
    await pool.query("DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE clinic_id = ANY($1))", [ids.clinics]);
    await pool.query("DELETE FROM bills WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM bed_stays WHERE bed_id IN (SELECT id FROM beds WHERE clinic_id = ANY($1))", [ids.clinics]);
    await pool.query("DELETE FROM admissions WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM beds WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM wards WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM services WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM doctor_fees WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM patients WHERE id = ANY($1)", [ids.patients]);
    await pool.query("DELETE FROM auth_users WHERE id = ANY($1)", [ids.users]);
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [ids.clinics]);
    await pool.end();
  });

  let admId;
  it("admits the patient and backdates the stay for deterministic room-rent math", async () => {
    const adm = await request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: patId, bed_id: bedId, doctor_id: docId });
    expect(adm.status).toBe(201);
    admId = adm.body.admission.id;
    await backdateStay(admId, 2); // stay started 2 days ago -> 3 days billed once discharged "today"
  });

  it("records a deposit; rejects once a bill exists (checked later)", async () => {
    const d = await request(app).post(`/api/ipd/admissions/${admId}/deposits`).set(auth(recepTok)).send({ amount: 3000, method: "cash" });
    expect(d.status).toBe(201);
    const list = await request(app).get(`/api/ipd/admissions/${admId}/deposits`).set(auth(recepTok));
    expect(list.body.deposits).toHaveLength(1);
  });

  let chargeId;
  it("logs a doctor visit and a service, priced from stored fee/price", async () => {
    const v = await request(app).post(`/api/ipd/admissions/${admId}/charges`).set(auth(recepTok)).send({ type: "visit", doctor_id: docId });
    expect(v.status).toBe(201);
    chargeId = v.body.charge.id;
    expect(Number(v.body.charge.unit_price)).toBe(1000);
    const s = await request(app).post(`/api/ipd/admissions/${admId}/charges`).set(auth(recepTok)).send({ type: "service", service_id: ids._serviceId, qty: 2 });
    expect(Number(s.body.charge.unit_price)).toBe(500);
  });

  it("owner can delete an unbilled charge; others cannot", async () => {
    const denied = await request(app).delete(`/api/ipd/admissions/${admId}/charges/${chargeId}`).set(auth(recepTok));
    expect(denied.status).toBe(403);
    const throwaway = await request(app).post(`/api/ipd/admissions/${admId}/charges`).set(auth(recepTok)).send({ type: "service", service_id: ids._serviceId });
    const del = await request(app).delete(`/api/ipd/admissions/${admId}/charges/${throwaway.body.charge.id}`).set(auth(ownerTok));
    expect(del.status).toBe(200);
  });

  it("running bill previews room rent + charges minus deposits while still admitted", async () => {
    const r = await request(app).get(`/api/ipd/admissions/${admId}/running-bill`).set(auth(recepTok));
    expect(r.status).toBe(200);
    // room: 3 days * 2000 = 6000; visit 1000; service 2*500=1000 => subtotal 8000
    expect(Number(r.body.subtotal)).toBe(8000);
    expect(Number(r.body.deposit_total)).toBe(3000);
    expect(Number(r.body.balance_so_far)).toBe(5000);
    expect(r.body.finalized_bill_id).toBeNull();
  });

  it("cannot finalize before discharge", async () => {
    const res = await request(app).post(`/api/ipd/admissions/${admId}/bill`).set(auth(ownerTok)).send({});
    expect(res.status).toBe(409);
  });

  let billId;
  it("discharging then finalizing produces the final bill, applies the deposit as a payment", async () => {
    const disch = await request(app).post(`/api/ipd/admissions/${admId}/discharge`).set(auth(recepTok)).send({});
    expect(disch.status).toBe(200);

    const bill = await request(app).post(`/api/ipd/admissions/${admId}/bill`).set(auth(ownerTok)).send({ payment: { amount: 1000, method: "card" } });
    expect(bill.status).toBe(201);
    billId = bill.body.bill.id;
    expect(bill.body.bill.bill_no).toBe("IPD-000001");
    expect(Number(bill.body.bill.subtotal)).toBe(8000);
    expect(Number(bill.body.bill.paid)).toBe(4000); // 3000 deposit + 1000 extra
    expect(bill.body.bill.status).toBe("partial");

    const detail = await request(app).get(`/api/billing/bills/${billId}`).set(auth(recepTok));
    expect(detail.body.items).toHaveLength(3); // room rent + visit + service
    const room = detail.body.items.find((i) => i.kind === "room_rent");
    expect(Number(room.qty)).toBe(3);
    expect(Number(room.amount)).toBe(6000);
    const visit = detail.body.items.find((i) => i.kind === "consultation");
    expect(Number(visit.doctor_share_amount)).toBe(700);
    expect(detail.body.payments).toHaveLength(2); // deposit + extra
  });

  it("cannot finalize a second time; a deposit can no longer be added", async () => {
    const again = await request(app).post(`/api/ipd/admissions/${admId}/bill`).set(auth(ownerTok)).send({});
    expect(again.status).toBe(409);
    const dep = await request(app).post(`/api/ipd/admissions/${admId}/deposits`).set(auth(recepTok)).send({ amount: 100 });
    expect(dep.status).toBe(409);
  });

  it("the final bill behaves like any OPD bill: payable, printable, void-able", async () => {
    const pay = await request(app).post(`/api/billing/bills/${billId}/payments`).set(auth(recepTok)).send({ amount: 4000 });
    expect(pay.body.bill.status).toBe("paid");
    const v = await request(app).post(`/api/billing/bills/${billId}/void`).set(auth(ownerTok));
    expect(v.body.bill.status).toBe("void");
  });

  it("cross-clinic staff cannot see this admission's deposits, charges, or running bill", async () => {
    expect((await request(app).get(`/api/ipd/admissions/${admId}/deposits`).set(auth(otherTok))).status).toBe(404);
    expect((await request(app).get(`/api/ipd/admissions/${admId}/charges`).set(auth(otherTok))).status).toBe(404);
    expect((await request(app).get(`/api/ipd/admissions/${admId}/running-bill`).set(auth(otherTok))).status).toBe(404);
  });
});
