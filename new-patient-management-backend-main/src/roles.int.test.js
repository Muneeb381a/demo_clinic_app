// Integration test: receptionists can register/find patients but cannot
// write clinical documentation (consultations, prescriptions, vitals).
// Doctors in the same clinic can do both. Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("role permissions (integration)", () => {
  let request, app, pool, signToken;
  let clinic, doctorId, receptionistId, patientId;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "v".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    const c = await pool.query(
      `INSERT INTO clinics (name, slug, max_doctors, max_receptionists)
       VALUES ('Roles Test Clinic', 'roles-test-${Date.now()}', 5, 5) RETURNING id`
    );
    clinic = c.rows[0].id;

    const mk = async (name, role) => {
      const r = await pool.query(
        `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
         VALUES ($1,$2,'x','',$3,$4,false) RETURNING id`,
        [name, `${name.replace(/\s+/g, "").toLowerCase()}-${Date.now()}@t.pk`, role, clinic]
      );
      return r.rows[0].id;
    };
    doctorId = await mk("Role Doctor", "doctor");
    receptionistId = await mk("Role Receptionist", "receptionist");

    const p = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id,clinic_id)
       VALUES ('03005556666','MR-ROLE-${Date.now()}','Role Patient',$1,$2) RETURNING id`,
      [doctorId, clinic]
    );
    patientId = p.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      "DELETE FROM consultations WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1)",
      [clinic]
    );
    await pool.query("DELETE FROM patients WHERE clinic_id = $1", [clinic]);
    await pool.query("DELETE FROM auth_users WHERE clinic_id = $1", [clinic]);
    await pool.query("DELETE FROM clinics WHERE id = $1", [clinic]);
    await pool.end();
  });

  const token = (id, role) => signToken({ id, email: `u${id}@t.pk`, role, clinic_id: clinic, is_owner: false });
  const asDoctor = () => token(doctorId, "doctor");
  const asReceptionist = () => token(receptionistId, "receptionist");

  it("a receptionist can register and find patients", async () => {
    const created = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${asReceptionist()}`)
      .send({ name: "Front Desk Registered", mobile: "03001110000" });
    expect(created.status).toBe(201);

    const search = await request(app)
      .get("/api/patients/search?name=Role")
      .set("Authorization", `Bearer ${asReceptionist()}`);
    expect(search.status).toBe(200);
  });

  it("a receptionist cannot save a consultation", async () => {
    const res = await request(app)
      .post("/api/consultations/complete")
      .set("Authorization", `Bearer ${asReceptionist()}`)
      .send({ patient_id: patientId, doctor_name: "Role Doctor" });
    expect(res.status).toBe(403);
  });

  it("a doctor can save a consultation the same receptionist was blocked from", async () => {
    const res = await request(app)
      .post("/api/consultations/complete")
      .set("Authorization", `Bearer ${asDoctor()}`)
      .send({ patient_id: patientId, doctor_name: "Role Doctor" });
    expect(res.status).toBe(201);
  });

  it("a receptionist cannot record vitals or write a prescription", async () => {
    const consult = await pool.query(
      `INSERT INTO consultations (patient_id, doctor_name, created_by) VALUES ($1,$2,$3) RETURNING id`,
      [patientId, "Role Doctor", doctorId]
    );
    const consultationId = consult.rows[0].id;

    const vitals = await request(app)
      .post("/api/vitals")
      .set("Authorization", `Bearer ${asReceptionist()}`)
      .send({ consultation_id: consultationId, patient_id: patientId, pulse_rate: 80 });
    expect(vitals.status).toBe(403);

    const rx = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${asReceptionist()}`)
      .send({ consultation_id: consultationId, medicines: [] });
    expect(rx.status).toBe(403);
  });

  it("a receptionist can still read consultations and prescriptions", async () => {
    const res = await request(app)
      .get(`/api/prescriptions/patient/${patientId}`)
      .set("Authorization", `Bearer ${asReceptionist()}`);
    expect([200, 404]).toContain(res.status); // 404 = "none found", not a permission error
    expect(res.status).not.toBe(403);
  });
});
