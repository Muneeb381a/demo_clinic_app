// Integration test: within one clinic, all staff (multiple doctors, a
// receptionist) share the same patient pool. This is the complement to
// isolation.int.test.js, which proves the opposite — separate clinics can't
// see each other. Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("clinic-wide sharing (integration)", () => {
  let request, app, pool, signToken;
  let clinic, owner, secondDoctor, receptionist, patientId, consultationId;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "w".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    const c = await pool.query(
      `INSERT INTO clinics (name, slug, max_doctors, max_receptionists)
       VALUES ('Shared Clinic', 'shared-clinic-${Date.now()}', 5, 5) RETURNING id`
    );
    clinic = c.rows[0].id;

    const mk = async (name, role, isOwner) => {
      const r = await pool.query(
        `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
         VALUES ($1,$2,'x','',$3,$4,$5) RETURNING id`,
        [name, `${name.replace(/\s+/g, "").toLowerCase()}-${Date.now()}@t.pk`, role, clinic, isOwner]
      );
      return r.rows[0].id;
    };
    owner = await mk("Owner Doc", "doctor", true);
    secondDoctor = await mk("Second Doc", "doctor", false);
    receptionist = await mk("Front Desk", "receptionist", false);

    // The owner registers a patient; the second doctor writes a consultation
    // for that same patient — proving the pool is shared, not per-doctor.
    const p = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id,clinic_id)
       VALUES ('03009998888','MR-SHARED-${Date.now()}','Shared Patient',$1,$2) RETURNING id`,
      [owner, clinic]
    );
    patientId = p.rows[0].id;

    const cons = await pool.query(
      `INSERT INTO consultations (patient_id,doctor_name,created_by)
       VALUES ($1,'Second Doc',$2) RETURNING id`,
      [patientId, secondDoctor]
    );
    consultationId = cons.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM consultations WHERE created_by = ANY($1)", [[owner, secondDoctor]]);
    await pool.query("DELETE FROM patients WHERE clinic_id = $1", [clinic]);
    await pool.query("DELETE FROM auth_users WHERE clinic_id = $1", [clinic]);
    await pool.query("DELETE FROM clinics WHERE id = $1", [clinic]);
    await pool.end();
  });

  const token = (id, role, isOwner = false) =>
    signToken({ id, email: `u${id}@t.pk`, role, clinic_id: clinic, is_owner: isOwner });

  it("a patient registered by one doctor is visible to another doctor in the same clinic", async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set("Authorization", `Bearer ${token(secondDoctor, "doctor")}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(patientId);
  });

  it("a receptionist in the same clinic can also see the patient and its consultation", async () => {
    const p = await request(app)
      .get(`/api/patients/${patientId}`)
      .set("Authorization", `Bearer ${token(receptionist, "receptionist")}`);
    expect(p.status).toBe(200);

    const c = await request(app)
      .get(`/api/consultations/${consultationId}`)
      .set("Authorization", `Bearer ${token(receptionist, "receptionist")}`);
    expect(c.status).toBe(200);
  });

  it("the clinic's patient list contains staff members' patients regardless of who registered them", async () => {
    const res = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${token(receptionist, "receptionist")}`);
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id)).toContain(patientId);
  });
});
