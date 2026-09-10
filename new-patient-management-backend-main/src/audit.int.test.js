// Integration test: the audit trail records access + changes. Gated on
// INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("audit log (integration)", () => {
  let request, app, pool, signToken, doctorId, patientId;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "z".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    const d = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role)
       VALUES ('Audit Doc','audit-${Date.now()}@t.pk','x','','doctor') RETURNING id`
    );
    doctorId = d.rows[0].id;
    const p = await pool.query(
      `INSERT INTO patients (mobile,mr_no,name,doctor_id)
       VALUES ('03007778888','MR-AUD-${Date.now()}','Audit Patient',$1) RETURNING id`,
      [doctorId]
    );
    patientId = p.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM audit_log WHERE user_id = $1", [doctorId]);
    await pool.query("DELETE FROM patients WHERE doctor_id = $1", [doctorId]);
    await pool.query("DELETE FROM auth_users WHERE id = $1", [doctorId]);
    await pool.end();
  });

  const token = () => signToken({ id: doctorId, email: "a@t.pk", role: "doctor" });

  // The audit write is fire-and-forget on `finish`; poll briefly for it.
  const waitForRow = async (sql, params) => {
    for (let i = 0; i < 20; i++) {
      const { rows } = await pool.query(sql, params);
      if (rows.length) return rows[0];
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };

  it("records a sensitive GET with entity type + id + user", async () => {
    await request(app).get(`/api/patients/${patientId}`).set("Authorization", `Bearer ${token()}`);

    const row = await waitForRow(
      `SELECT * FROM audit_log
        WHERE user_id = $1 AND action = 'GET' AND entity_type = 'patient' AND entity_id = $2
        ORDER BY id DESC LIMIT 1`,
      [doctorId, String(patientId)]
    );
    expect(row).toBeTruthy();
    expect(row.status).toBe(200);
    expect(row.path).toBe(`/api/patients/${patientId}`);
  });

  it("records a mutation (POST) with the response status", async () => {
    await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${token()}`)
      .send({ name: "New Via Audit", mobile: "03001230000" });

    const row = await waitForRow(
      `SELECT * FROM audit_log
        WHERE user_id = $1 AND action = 'POST' AND path = '/api/patients'
        ORDER BY id DESC LIMIT 1`,
      [doctorId]
    );
    expect(row).toBeTruthy();
    expect(row.status).toBe(201);
  });

  it("does not record a plain catalogue GET", async () => {
    await request(app).get("/api/symptoms").set("Authorization", `Bearer ${token()}`);
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE user_id = $1 AND path = '/api/symptoms'",
      [doctorId]
    );
    expect(rows[0].n).toBe(0);
  });
});
