// Integration test: clinic plans (seat + feature presets) and requireFeature.
// Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("clinic plans (integration)", () => {
  let request, app, pool, signToken;
  let adminId;
  const createdClinicIds = [];
  const createdUserIds = [];

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
       VALUES ('Platform Admin','plan-padmin-${Date.now()}@t.pk','x','','platform_admin') RETURNING id`
    );
    adminId = a.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM auth_users WHERE id = ANY($1)", [createdUserIds]);
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [createdClinicIds]);
    await pool.query("DELETE FROM auth_users WHERE id = $1", [adminId]);
    await pool.end();
  });

  const asAdmin = () => signToken({ id: adminId, email: "a@t.pk", role: "platform_admin", clinic_id: null });

  const createClinic = (overrides = {}) =>
    request(app)
      .post("/api/platform/clinics")
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({
        name: overrides.name || "Plan Test Clinic",
        slug: overrides.slug || `plan-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        owner: overrides.owner || { name: "Owner", email: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@t.pk`, password: "password1" },
        ...overrides,
      });

  it("defaults to the 'clinic' plan preset when no plan is given", async () => {
    const res = await createClinic();
    expect(res.status).toBe(201);
    createdClinicIds.push(res.body.clinic.id);
    createdUserIds.push(res.body.owner.id);

    expect(res.body.clinic.plan).toBe("clinic");
    expect(res.body.clinic.max_doctors).toBe(1);
    expect(res.body.clinic.max_receptionists).toBe(1);
    expect(res.body.clinic.features).toEqual({ ai_suggestions: false, chatbot: true, whatsapp_reminders: false });
  });

  it("applies the 'hospital' preset when plan is given", async () => {
    const res = await createClinic({ plan: "hospital" });
    expect(res.status).toBe(201);
    createdClinicIds.push(res.body.clinic.id);
    createdUserIds.push(res.body.owner.id);

    expect(res.body.clinic.plan).toBe("hospital");
    expect(res.body.clinic.max_doctors).toBe(10);
    expect(res.body.clinic.max_receptionists).toBe(5);
    expect(res.body.clinic.features).toEqual({ ai_suggestions: true, chatbot: true, whatsapp_reminders: true });
  });

  it("an explicit max_doctors/features overrides the plan's preset", async () => {
    const res = await createClinic({ plan: "hospital", max_doctors: 3, features: { chatbot: false } });
    expect(res.status).toBe(201);
    createdClinicIds.push(res.body.clinic.id);
    createdUserIds.push(res.body.owner.id);

    expect(res.body.clinic.max_doctors).toBe(3);
    expect(res.body.clinic.max_receptionists).toBe(5); // preset, not overridden
    expect(res.body.clinic.features).toEqual({ chatbot: false }); // fully replaced, not merged, on create
  });

  it("rejects an unknown plan name", async () => {
    const res = await createClinic({ plan: "enterprise" });
    expect(res.status).toBe(400);
  });

  it("PATCH plan re-applies that plan's feature defaults without touching seat limits", async () => {
    const created = await createClinic(); // 'clinic' plan, 1/1 seats
    const clinicId = created.body.clinic.id;
    createdClinicIds.push(clinicId);
    createdUserIds.push(created.body.owner.id);

    const patched = await request(app)
      .patch(`/api/platform/clinics/${clinicId}`)
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({ plan: "hospital" });

    expect(patched.status).toBe(200);
    expect(patched.body.clinic.plan).toBe("hospital");
    expect(patched.body.clinic.features).toEqual({ ai_suggestions: true, chatbot: true, whatsapp_reminders: true });
    expect(patched.body.clinic.max_doctors).toBe(1); // untouched by the plan switch
  });

  it("PATCH features (no plan) merges onto the existing flags", async () => {
    const created = await createClinic(); // ai_suggestions: false, chatbot: true, whatsapp_reminders: false
    const clinicId = created.body.clinic.id;
    createdClinicIds.push(clinicId);
    createdUserIds.push(created.body.owner.id);

    const patched = await request(app)
      .patch(`/api/platform/clinics/${clinicId}`)
      .set("Authorization", `Bearer ${asAdmin()}`)
      .send({ features: { ai_suggestions: true } });

    expect(patched.status).toBe(200);
    expect(patched.body.clinic.features).toEqual({ ai_suggestions: true, chatbot: true, whatsapp_reminders: false });
  });

  it("requireFeature blocks a clinic-plan doctor from the AI suggestion routes", async () => {
    const created = await createClinic({ owner: { name: "Doc", email: `nosug-${Date.now()}@t.pk`, password: "password1" } });
    const clinicId = created.body.clinic.id;
    createdClinicIds.push(clinicId);
    createdUserIds.push(created.body.owner.id);

    const login = await request(app).post("/api/auth/login").send({ email: created.body.owner.email, password: "password1" });
    const token = login.body.accessToken;

    const res = await request(app)
      .get("/api/suggest/symptoms?q=fever")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("requireFeature allows a hospital-plan doctor into the AI suggestion routes", async () => {
    const created = await createClinic({ plan: "hospital", owner: { name: "Doc", email: `sug-${Date.now()}@t.pk`, password: "password1" } });
    const clinicId = created.body.clinic.id;
    createdClinicIds.push(clinicId);
    createdUserIds.push(created.body.owner.id);

    const login = await request(app).post("/api/auth/login").send({ email: created.body.owner.email, password: "password1" });
    const token = login.body.accessToken;

    const res = await request(app)
      .get("/api/suggest/symptoms?q=fever")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).not.toBe(403);
  });

  it("a platform admin bypasses requireFeature entirely", async () => {
    const res = await request(app)
      .get("/api/suggest/symptoms?q=fever")
      .set("Authorization", `Bearer ${asAdmin()}`);
    expect(res.status).not.toBe(403);
  });

  it("login/refresh/me all return the clinic's plan and features", async () => {
    const created = await createClinic({ plan: "hospital", owner: { name: "Doc", email: `meplan-${Date.now()}@t.pk`, password: "password1" } });
    createdClinicIds.push(created.body.clinic.id);
    createdUserIds.push(created.body.owner.id);

    const login = await request(app).post("/api/auth/login").send({ email: created.body.owner.email, password: "password1" });
    expect(login.body.user.clinic).toEqual({ plan: "hospital", features: { ai_suggestions: true, chatbot: true, whatsapp_reminders: true } });

    const cookie = login.headers["set-cookie"];
    const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refreshed.body.user.clinic).toEqual({ plan: "hospital", features: { ai_suggestions: true, chatbot: true, whatsapp_reminders: true } });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.body.user.clinic).toEqual({ plan: "hospital", features: { ai_suggestions: true, chatbot: true, whatsapp_reminders: true } });
  });

  it("a platform admin's session has clinic: null", async () => {
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${asAdmin()}`);
    expect(me.body.user.clinic).toBeNull();
  });
});
