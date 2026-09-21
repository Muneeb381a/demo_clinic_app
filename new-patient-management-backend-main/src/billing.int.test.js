// Integration test: fees, services, bills, payments (Phase 1 hospital billing).
// Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("billing (integration)", () => {
  let request, app, pool, signToken;
  const ids = { clinics: [], users: [], patients: [] };
  let A, B, ownerTok, recepTok, otherTok, noBillingTok, visitingDocId, ownerDocId, patientA, patientB;
  const ts = Date.now();

  const mkUser = async (name, role, clinicId, isOwner = false) => {
    const r = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ($1,$2,'x','',$3,$4,$5) RETURNING id`,
      [name, `${name.replace(/\W/g, "")}-${ts}-${Math.random().toString(36).slice(2, 6)}@t.pk`, role, clinicId, isOwner]
    );
    ids.users.push(r.rows[0].id);
    return r.rows[0].id;
  };
  const mkClinic = async (slug, features) => {
    const r = await pool.query(
      "INSERT INTO clinics (name, slug, features) VALUES ($1,$2,$3) RETURNING id",
      [slug, `${slug}-${ts}`, JSON.stringify(features)]
    );
    ids.clinics.push(r.rows[0].id);
    return r.rows[0].id;
  };
  const tok = (id, role, clinic, owner = false) => signToken({ id, email: "x@t.pk", role, clinic_id: clinic, is_owner: owner });
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "u".repeat(48);
    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    A = await mkClinic("bill-a", { billing: true });
    B = await mkClinic("bill-b", { billing: true });
    const N = await mkClinic("bill-off", { billing: false });

    ownerDocId = await mkUser("OwnerDoc", "doctor", A, true);
    visitingDocId = await mkUser("VisitDoc", "doctor", A);
    const recepId = await mkUser("Recep", "receptionist", A);
    const otherOwner = await mkUser("OtherOwner", "doctor", B, true);
    const noBillOwner = await mkUser("NoBill", "doctor", N, true);
    ownerTok = tok(ownerDocId, "doctor", A, true);
    recepTok = tok(recepId, "receptionist", A);
    otherTok = tok(otherOwner, "doctor", B, true);
    noBillingTok = tok(noBillOwner, "doctor", N, true);

    for (const [clinic, name] of [[A, "Pat A"], [B, "Pat B"]]) {
      const p = await pool.query(
        "INSERT INTO patients (name, mobile, mr_no, clinic_id, doctor_id) VALUES ($1,'03001234567',$2,$3,$4) RETURNING id",
        [name, `MR-${ts}-${clinic}`, clinic, clinic === A ? ownerDocId : otherOwner]
      );
      ids.patients.push(p.rows[0].id);
      if (clinic === A) patientA = p.rows[0].id; else patientB = p.rows[0].id;
    }
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM payments WHERE bill_id IN (SELECT id FROM bills WHERE clinic_id = ANY($1))", [ids.clinics]);
    await pool.query("DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE clinic_id = ANY($1))", [ids.clinics]);
    await pool.query("DELETE FROM bills WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM patients WHERE id = ANY($1)", [ids.patients]);
    await pool.query("DELETE FROM auth_users WHERE id = ANY($1)", [ids.users]);
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [ids.clinics]);
    await pool.end();
  });

  it("blocks a clinic without the billing feature", async () => {
    const res = await request(app).get("/api/billing/doctors").set(auth(noBillingTok));
    expect(res.status).toBe(403);
  });

  it("only the owner can set fees; percentages must add up to 100", async () => {
    const asRecep = await request(app).put(`/api/billing/doctors/${visitingDocId}`).set(auth(recepTok))
      .send({ doctor_type: "visiting", consultation_fee: 1000, hospital_share_pct: 30, doctor_share_pct: 70 });
    expect(asRecep.status).toBe(403);

    const bad = await request(app).put(`/api/billing/doctors/${visitingDocId}`).set(auth(ownerTok))
      .send({ doctor_type: "visiting", consultation_fee: 1000, hospital_share_pct: 30, doctor_share_pct: 60 });
    expect(bad.status).toBe(400);

    const ok = await request(app).put(`/api/billing/doctors/${visitingDocId}`).set(auth(ownerTok))
      .send({ doctor_type: "visiting", consultation_fee: 1000, followup_fee: 500, hospital_share_pct: 30, doctor_share_pct: 70 });
    expect(ok.status).toBe(200);

    await request(app).put(`/api/billing/doctors/${ownerDocId}`).set(auth(ownerTok))
      .send({ doctor_type: "staff", consultation_fee: 800 });

    const list = await request(app).get("/api/billing/doctors").set(auth(recepTok));
    const v = list.body.doctors.find((d) => d.doctor_id === visitingDocId);
    expect(Number(v.consultation_fee)).toBe(1000);
    expect(Number(v.doctor_share_pct)).toBe(70);
  });

  it("cannot set fees for a doctor of another clinic", async () => {
    const res = await request(app).put(`/api/billing/doctors/${visitingDocId}`).set(auth(otherTok))
      .send({ doctor_type: "staff", consultation_fee: 1 });
    expect(res.status).toBe(404);
  });

  let serviceId;
  it("owner creates a service; staff can read it", async () => {
    const c = await request(app).post("/api/billing/services").set(auth(ownerTok))
      .send({ name: "ECG", category: "procedure", price: 600 });
    expect(c.status).toBe(201);
    serviceId = c.body.service.id;
    const denied = await request(app).post("/api/billing/services").set(auth(recepTok)).send({ name: "X", price: 1 });
    expect(denied.status).toBe(403);
    const list = await request(app).get("/api/billing/services").set(auth(recepTok));
    expect(list.body.services.map((s) => s.name)).toContain("ECG");
  });

  let billId;
  it("creates a bill from stored prices, splits the visiting doctor's share, numbers it", async () => {
    const res = await request(app).post("/api/billing/bills").set(auth(recepTok)).send({
      patient_id: patientA,
      items: [{ type: "consultation", doctor_id: visitingDocId }, { type: "service", service_id: serviceId, qty: 2 }],
      discount: 100,
      payment: { amount: 500, method: "cash" },
      // A client-sent price must be ignored.
      total: 1,
    });
    expect(res.status).toBe(201);
    billId = res.body.bill.id;
    expect(res.body.bill.bill_no).toBe("OPD-000001");
    expect(Number(res.body.bill.subtotal)).toBe(2200); // 1000 + 2*600
    expect(Number(res.body.bill.total)).toBe(2100);
    expect(res.body.bill.status).toBe("partial");

    const detail = await request(app).get(`/api/billing/bills/${billId}`).set(auth(recepTok));
    const cons = detail.body.items.find((i) => i.kind === "consultation");
    expect(Number(cons.doctor_share_amount)).toBe(700);
    expect(Number(cons.hospital_share_amount)).toBe(300);
    const svc = detail.body.items.find((i) => i.kind === "service");
    expect(Number(svc.hospital_share_amount)).toBe(1200);
    expect(detail.body.payments).toHaveLength(1);
  });

  it("later fee edits do not rewrite an existing bill", async () => {
    await request(app).put(`/api/billing/doctors/${visitingDocId}`).set(auth(ownerTok))
      .send({ doctor_type: "visiting", consultation_fee: 5000, hospital_share_pct: 50, doctor_share_pct: 50 });
    const detail = await request(app).get(`/api/billing/bills/${billId}`).set(auth(recepTok));
    const cons = detail.body.items.find((i) => i.kind === "consultation");
    expect(Number(cons.unit_price)).toBe(1000);
    expect(Number(cons.doctor_share_amount)).toBe(700);
  });

  it("accepts partial payments up to the balance, rejects overpayment, marks paid", async () => {
    const over = await request(app).post(`/api/billing/bills/${billId}/payments`).set(auth(recepTok)).send({ amount: 5000 });
    expect(over.status).toBe(400);
    const p1 = await request(app).post(`/api/billing/bills/${billId}/payments`).set(auth(recepTok)).send({ amount: 1000, method: "card" });
    expect(p1.body.bill.status).toBe("partial");
    const p2 = await request(app).post(`/api/billing/bills/${billId}/payments`).set(auth(recepTok)).send({ amount: 600 });
    expect(p2.body.bill.status).toBe("paid");
    expect(Number(p2.body.bill.paid)).toBe(2100);
  });

  it("numbers bills sequentially and independently per clinic", async () => {
    await request(app).put(`/api/billing/doctors/${ownerDocId}`).set(auth(ownerTok)).send({ doctor_type: "staff", consultation_fee: 800 });
    const second = await request(app).post("/api/billing/bills").set(auth(ownerTok))
      .send({ patient_id: patientA, items: [{ type: "consultation", doctor_id: ownerDocId }] });
    expect(second.body.bill.bill_no).toBe("OPD-000002");

    const svcB = await request(app).post("/api/billing/services").set(auth(otherTok)).send({ name: "B svc", price: 10 });
    const inB = await request(app).post("/api/billing/bills").set(auth(otherTok))
      .send({ patient_id: patientB, items: [{ type: "service", service_id: svcB.body.service.id }] });
    expect(inB.body.bill.bill_no).toBe("OPD-000001");
  });

  it("rejects a bad discount and cross-clinic patients/bills", async () => {
    const badDisc = await request(app).post("/api/billing/bills").set(auth(ownerTok))
      .send({ patient_id: patientA, items: [{ type: "consultation", doctor_id: ownerDocId }], discount: 99999 });
    expect(badDisc.status).toBe(400);

    const otherPatient = await request(app).post("/api/billing/bills").set(auth(ownerTok))
      .send({ patient_id: patientB, items: [{ type: "consultation", doctor_id: ownerDocId }] });
    expect(otherPatient.status).toBe(404);

    const peek = await request(app).get(`/api/billing/bills/${billId}`).set(auth(otherTok));
    expect(peek.status).toBe(404);
  });

  it("only the owner can void; a void bill takes no payments", async () => {
    const denied = await request(app).post(`/api/billing/bills/${billId}/void`).set(auth(recepTok));
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/api/billing/bills/${billId}/void`).set(auth(ownerTok));
    expect(ok.body.bill.status).toBe("void");
    const pay = await request(app).post(`/api/billing/bills/${billId}/payments`).set(auth(recepTok)).send({ amount: 1 });
    expect(pay.status).toBe(409);
  });

  it("gives every concurrent bill a unique number", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post("/api/billing/bills").set(auth(ownerTok))
          .send({ patient_id: patientA, items: [{ type: "consultation", doctor_id: ownerDocId }] })
      )
    );
    const nos = results.map((r) => r.body.bill.bill_no);
    expect(new Set(nos).size).toBe(5);
  });
});
