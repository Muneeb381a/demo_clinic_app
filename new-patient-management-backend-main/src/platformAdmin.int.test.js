// Integration test: platform-admin clinic provisioning + suspension.
// Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("platform admin (integration)", () => {
  let request, app, pool, signToken;
  let adminId, doctorClinic, doctorId;
  const slug = `platform-test-${Date.now()}`;
  const ownerEmail = `owner-${Date.now()}@t.pk`;
  const createdClinicIds = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "u".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    const a = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role)
       VALUES ('Platform Admin','padmin-${Date.now()}@t.pk','x','','platform_admin') RETURNING id`
    );
    adminId = a.rows[0].id;

    // An ordinary doctor, to prove non-admins are rejected.
    const c = await pool.query(
      `INSERT INTO clinics (name, slug) VALUES ('Requester Clinic', 'requester-${Date.now()}') RETURNING id`
    );
    doctorClinic = c.rows[0].id;
    const d = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ('Some Doctor','doc-${Date.now()}@t.pk','x','','doctor',$1,true) RETURNING id`,
      [doctorClinic]
    );
    doctorId = d.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM auth_users WHERE clinic_id = ANY($1)", [[doctorClinic, ...createdClinicIds]]);
    await pool.query("DELETE FROM auth_users WHERE id = $1", [adminId]);
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [[doctorClinic, ...createdClinicIds]]);
    await pool.end();
  });

  const asAdmin = () => signToken({ id: adminId, email: "a@t.pk", role: "platform_admin", clinic_id: null });
  const asDoctor = () => signToken({ id: doctorId, email: "d@t.pk", role: "doctor", clinic_id: doctorClinic, is_owner: true });

  it("a non-admin cannot create a clinic", async () => {
    const res = await request(app)
      .post("/api/platform/clinics")
      .set("Authorization", `Bearer ${asDoctor()}`)
      .send({ name: "Nope", slug: "nope-clinic", owner: { name: "X", email: "x@t.pk", password: "password1" } });
    expect(res.status).toBe(403);
  });

  it("the platform admin can create a clinic with its owner", async () => {
    const res = await request(app)
      .post("/api/platform/clinics")
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({
        name: "New Clinic",
        slug,
        max_doctors: 3,
        max_receptionists: 2,
        owner: { name: "Clinic Owner", email: ownerEmail, password: "password1" },
      });
    expect(res.status).toBe(201);
    expect(res.body.clinic.slug).toBe(slug);
    expect(res.body.owner.role).toBe("doctor");
    expect(res.body.owner.is_owner).toBe(true);
    createdClinicIds.push(res.body.clinic.id);

    // The owner can actually log in with the password the admin set.
    const login = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    expect(login.status).toBe(200);
  });

  it("creating a hospital-plan clinic with owner.consultation_fee seeds a doctor_fees row", async () => {
    const hospitalSlug = `platform-hospital-${Date.now()}`;
    const hospitalOwnerEmail = `hospital-owner-${Date.now()}@t.pk`;
    const res = await request(app)
      .post("/api/platform/clinics")
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({
        name: "New Hospital",
        slug: hospitalSlug,
        plan: "hospital",
        owner: { name: "Hospital Owner", email: hospitalOwnerEmail, password: "password1", consultation_fee: 1500, followup_fee: 500 },
      });
    expect(res.status).toBe(201);
    createdClinicIds.push(res.body.clinic.id);

    const login = await request(app).post("/api/auth/login").send({ email: hospitalOwnerEmail, password: "password1" });
    const doctors = await request(app).get("/api/billing/doctors").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(doctors.status).toBe(200);
    const fee = doctors.body.doctors.find((d) => d.doctor_id === res.body.owner.id);
    expect(fee.configured).toBe(true);
    expect(Number(fee.consultation_fee)).toBe(1500);
    expect(Number(fee.followup_fee)).toBe(500);
  });

  it("a clinic-plan clinic (billing off) ignores owner.consultation_fee — no doctor_fees row", async () => {
    const clinicSlug = `platform-nobilling-${Date.now()}`;
    const noBillingOwnerEmail = `nobilling-owner-${Date.now()}@t.pk`;
    const res = await request(app)
      .post("/api/platform/clinics")
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({
        name: "New Clinic No Billing",
        slug: clinicSlug,
        owner: { name: "Plain Owner", email: noBillingOwnerEmail, password: "password1", consultation_fee: 1000 },
      });
    expect(res.status).toBe(201);
    createdClinicIds.push(res.body.clinic.id);

    const fee = await pool.query("SELECT * FROM doctor_fees WHERE doctor_id = $1", [res.body.owner.id]);
    expect(fee.rowCount).toBe(0);
  });

  it("a duplicate slug is rejected", async () => {
    const res = await request(app)
      .post("/api/platform/clinics")
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({ name: "Dup", slug, owner: { name: "X", email: `dup-${Date.now()}@t.pk`, password: "password1" } });
    expect(res.status).toBe(409);
  });

  it("lists clinics with staff counts", async () => {
    const res = await request(app).get("/api/platform/clinics").set("Authorization", `Bearer ${asAdmin()}`);
    expect(res.status).toBe(200);
    const found = res.body.clinics.find((c) => c.slug === slug);
    expect(found).toBeTruthy();
    expect(Number(found.doctor_count)).toBe(1);
  });

  it("suspending a clinic blocks its staff, reactivating restores them", async () => {
    const clinicId = createdClinicIds[0];
    const ownerToken = () => request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });

    const before = await ownerToken();
    const okBefore = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${before.body.accessToken}`);
    expect(okBefore.status).toBe(200);

    const suspend = await request(app)
      .patch(`/api/platform/clinics/${clinicId}`)
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({ status: "suspended" });
    expect(suspend.status).toBe(200);

    const blocked = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${before.body.accessToken}`);
    expect(blocked.status).toBe(403);

    const reactivate = await request(app)
      .patch(`/api/platform/clinics/${clinicId}`)
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({ status: "active" });
    expect(reactivate.status).toBe(200);

    const restored = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${before.body.accessToken}`);
    expect(restored.status).toBe(200);
  });
});
