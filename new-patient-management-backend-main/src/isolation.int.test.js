// Integration test: per-doctor data isolation across the real Express app and
// a real Postgres. Gated on INTEGRATION_DB_URL so the fast unit run skips it;
// CI runs it in the job that already has a Postgres service.
//
//   INTEGRATION_DB_URL=postgres://... npx vitest run src/isolation.int.test.js

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("per-doctor isolation (integration)", () => {
  let request, app, pool, signToken;
  let docA, docB, patientA, patientB, consultA;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "x".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    // Two doctors
    const a = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role)
       VALUES ('Doc A','a-${Date.now()}@t.pk','x','','doctor') RETURNING id`
    );
    const b = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role)
       VALUES ('Doc B','b-${Date.now()}@t.pk','x','','doctor') RETURNING id`
    );
    docA = a.rows[0].id;
    docB = b.rows[0].id;

    const pa = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id)
       VALUES ('03001112222','MR-A-${Date.now()}','Alice',$1) RETURNING id`, [docA]
    );
    const pb = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id)
       VALUES ('03003334444','MR-B-${Date.now()}','Bob',$1) RETURNING id`, [docB]
    );
    patientA = pa.rows[0].id;
    patientB = pb.rows[0].id;

    const ca = await pool.query(
      `INSERT INTO consultations (patient_id,doctor_name,created_by)
       VALUES ($1,'Doc A',$2) RETURNING id`, [patientA, docA]
    );
    consultA = ca.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM consultations WHERE created_by = ANY($1)", [[docA, docB]]);
    await pool.query("DELETE FROM patients WHERE doctor_id = ANY($1)", [[docA, docB]]);
    await pool.query("DELETE FROM auth_users WHERE id = ANY($1)", [[docA, docB]]);
    await pool.end();
  });

  const as = (id) => signToken({ id, email: `d${id}@t.pk`, role: "doctor" });

  it("a doctor's patient list contains only their own patients", async () => {
    const res = await request(app).get("/api/patients").set("Authorization", `Bearer ${as(docA)}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((p) => p.id);
    expect(ids).toContain(patientA);
    expect(ids).not.toContain(patientB);
  });

  it("GET /api/patients/:id returns 404 for another doctor's patient", async () => {
    const mine = await request(app).get(`/api/patients/${patientA}`).set("Authorization", `Bearer ${as(docA)}`);
    expect(mine.status).toBe(200);

    const theirs = await request(app).get(`/api/patients/${patientB}`).set("Authorization", `Bearer ${as(docA)}`);
    expect(theirs.status).toBe(404);
  });

  it("search does not surface another doctor's patient", async () => {
    const res = await request(app)
      .get("/api/patients/search?name=Bob")
      .set("Authorization", `Bearer ${as(docA)}`);
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it("consultation history of another doctor's patient is 404", async () => {
    const res = await request(app)
      .get(`/api/patient-history/${patientA}`)
      .set("Authorization", `Bearer ${as(docB)}`);
    expect(res.status).toBe(404);
  });

  it("creating a consultation for another doctor's patient is rejected", async () => {
    const res = await request(app)
      .post("/api/consultations")
      .set("Authorization", `Bearer ${as(docB)}`)
      .send({ patient_id: patientA, doctor_name: "Doc B" });
    expect(res.status).toBe(404);
  });

  it("prescriptions for another doctor's consultation are 404", async () => {
    const res = await request(app)
      .get(`/api/prescriptions/consultation/${consultA}`)
      .set("Authorization", `Bearer ${as(docB)}`);
    expect(res.status).toBe(404);
  });
});
