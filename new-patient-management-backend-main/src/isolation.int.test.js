// Integration test: per-clinic data isolation across the real Express app and
// a real Postgres. Gated on INTEGRATION_DB_URL so the fast unit run skips it;
// CI runs it in the job that already has a Postgres service.
//
//   INTEGRATION_DB_URL=postgres://... npx vitest run src/isolation.int.test.js

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("per-clinic isolation (integration)", () => {
  let request, app, pool, signToken;
  let clinicA, clinicB, docA, docB, patientA, patientB, consultA;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "x".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    // Two separate clinics (the tenant boundary), one doctor each.
    const ca = await pool.query(
      `INSERT INTO clinics (name, slug) VALUES ('Clinic A', 'clinic-a-${Date.now()}') RETURNING id`
    );
    const cb = await pool.query(
      `INSERT INTO clinics (name, slug) VALUES ('Clinic B', 'clinic-b-${Date.now()}') RETURNING id`
    );
    clinicA = ca.rows[0].id;
    clinicB = cb.rows[0].id;

    const a = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ('Doc A','a-${Date.now()}@t.pk','x','','doctor',$1,true) RETURNING id`,
      [clinicA]
    );
    const b = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ('Doc B','b-${Date.now()}@t.pk','x','','doctor',$1,true) RETURNING id`,
      [clinicB]
    );
    docA = a.rows[0].id;
    docB = b.rows[0].id;

    const pa = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id,clinic_id)
       VALUES ('03001112222','MR-A-${Date.now()}','Alice',$1,$2) RETURNING id`, [docA, clinicA]
    );
    const pb = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id,clinic_id)
       VALUES ('03003334444','MR-B-${Date.now()}','Bob',$1,$2) RETURNING id`, [docB, clinicB]
    );
    patientA = pa.rows[0].id;
    patientB = pb.rows[0].id;

    const cons = await pool.query(
      `INSERT INTO consultations (patient_id,doctor_name,created_by)
       VALUES ($1,'Doc A',$2) RETURNING id`, [patientA, docA]
    );
    consultA = cons.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM consultations WHERE created_by = ANY($1)", [[docA, docB]]);
    await pool.query("DELETE FROM patients WHERE clinic_id = ANY($1)", [[clinicA, clinicB]]);
    await pool.query("DELETE FROM auth_users WHERE id = ANY($1)", [[docA, docB]]);
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [[clinicA, clinicB]]);
    await pool.end();
  });

  const as = (id, clinic_id) => signToken({ id, email: `d${id}@t.pk`, role: "doctor", clinic_id, is_owner: true });
  const tokenA = () => as(docA, clinicA);
  const tokenB = () => as(docB, clinicB);

  it("a doctor's patient list contains only their clinic's patients", async () => {
    const res = await request(app).get("/api/patients").set("Authorization", `Bearer ${tokenA()}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((p) => p.id);
    expect(ids).toContain(patientA);
    expect(ids).not.toContain(patientB);
  });

  it("GET /api/patients/:id returns 404 for another clinic's patient", async () => {
    const mine = await request(app).get(`/api/patients/${patientA}`).set("Authorization", `Bearer ${tokenA()}`);
    expect(mine.status).toBe(200);

    const theirs = await request(app).get(`/api/patients/${patientB}`).set("Authorization", `Bearer ${tokenA()}`);
    expect(theirs.status).toBe(404);
  });

  it("search does not surface another clinic's patient", async () => {
    const res = await request(app)
      .get("/api/patients/search?name=Bob")
      .set("Authorization", `Bearer ${tokenA()}`);
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it("consultation history of another clinic's patient is 404", async () => {
    const res = await request(app)
      .get(`/api/patient-history/${patientA}`)
      .set("Authorization", `Bearer ${tokenB()}`);
    expect(res.status).toBe(404);
  });

  it("creating a consultation for another clinic's patient is rejected", async () => {
    const res = await request(app)
      .post("/api/consultations")
      .set("Authorization", `Bearer ${tokenB()}`)
      .send({ patient_id: patientA, doctor_name: "Doc B" });
    expect(res.status).toBe(404);
  });

  it("prescriptions for another clinic's consultation are 404", async () => {
    const res = await request(app)
      .get(`/api/prescriptions/consultation/${consultA}`)
      .set("Authorization", `Bearer ${tokenB()}`);
    expect(res.status).toBe(404);
  });

  it("the print / pdf / detail views render for the owning clinic and 404 for others", async () => {
    const urls = [
      `/api/patients/${patientA}/consultations/${consultA}/print`,
      `/api/patients/${patientA}/consultations/${consultA}/pdf`,
      `/api/patients/${patientA}/consultations/${consultA}`,
    ];
    for (const url of urls) {
      const mine = await request(app).get(url).set("Authorization", `Bearer ${tokenA()}`);
      expect(mine.status).toBe(200);
      const theirs = await request(app).get(url).set("Authorization", `Bearer ${tokenB()}`);
      expect(theirs.status).toBe(404);
    }
  });
});
