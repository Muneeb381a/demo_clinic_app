// Integration test: 7-day (configurable) trial accounts. Gated on
// INTEGRATION_DB_URL. The whole point of this feature is that only the
// database's own clock can end a trial — these tests only ever move time by
// writing to Postgres directly (backdating trial_started_at/trial_ends_at),
// exactly mirroring the one lever the feature is designed to resist: there
// is deliberately no way to simulate "the customer changed their device
// clock" here, because that's exactly the attack the design makes moot.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("trial accounts (integration)", () => {
  let request, app, pool, signToken;
  let adminId;
  const createdClinicIds = [];
  const createdUserIds = [];
  const ts = Date.now();

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
       VALUES ('Platform Admin','trial-padmin-${ts}@t.pk','x','','platform_admin') RETURNING id`
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

  const createTrialClinic = async (overrides = {}) => {
    const email = `owner-${ts}-${Math.random().toString(36).slice(2, 7)}@t.pk`;
    const res = await request(app).post("/api/platform/clinics").set("Authorization", `Bearer ${asAdmin()}`).send({
      name: "Trial Clinic", slug: `trial-${ts}-${Math.random().toString(36).slice(2, 7)}`,
      is_trial: true, trial_days: 7,
      owner: { name: "Owner", email, password: "password1" },
      ...overrides,
    });
    createdClinicIds.push(res.body.clinic.id);
    createdUserIds.push(res.body.owner.id);
    return { clinic: res.body.clinic, ownerEmail: email };
  };

  it("a brand-new trial clinic has no trial_started_at until someone logs in", async () => {
    const { clinic } = await createTrialClinic();
    expect(clinic.is_trial).toBe(true);
    expect(clinic.trial_days).toBe(7);
    expect(clinic.trial_started_at).toBeNull();
    expect(clinic.trial_ends_at).toBeNull();
  });

  it("the first login starts the clock (trial_ends_at ~= now + trial_days), reported back in the login response", async () => {
    const { ownerEmail } = await createTrialClinic({ trial_days: 3 });
    const login = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    expect(login.status).toBe(200);
    expect(login.body.user.clinic.is_trial).toBe(true);
    expect(login.body.user.clinic.trial_expired).toBe(false);
    const endsAt = new Date(login.body.user.clinic.trial_ends_at);
    const expected = Date.now() + 3 * 86400000;
    expect(Math.abs(endsAt.getTime() - expected)).toBeLessThan(60000); // within a minute
  });

  it("a second login does not reset an already-started clock", async () => {
    const { ownerEmail, clinic } = await createTrialClinic();
    const first = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    const firstEndsAt = first.body.user.clinic.trial_ends_at;

    // Backdate as if the trial had started a while ago, then log in again.
    // (Both sides computed from NOW() directly, not from each other — a
    // single UPDATE's SET clause evaluates every expression against the OLD
    // row, so `trial_ends_at = trial_started_at + ...` here would silently
    // read the pre-update trial_started_at, not the one just assigned above.)
    await pool.query("UPDATE clinics SET trial_started_at = NOW() - interval '2 days', trial_ends_at = NOW() + interval '5 days' WHERE id = $1", [clinic.id]);
    const before = await pool.query("SELECT trial_ends_at FROM clinics WHERE id = $1", [clinic.id]);

    const second = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    expect(second.body.user.clinic.trial_ends_at).not.toBe(firstEndsAt); // did change (we backdated it ourselves)
    expect(new Date(second.body.user.clinic.trial_ends_at).getTime()).toBe(new Date(before.rows[0].trial_ends_at).getTime()); // but login didn't touch it again
  });

  it("an expired trial (per the database's own clock) blocks a real endpoint but not /me", async () => {
    const { ownerEmail, clinic } = await createTrialClinic();
    const login = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    const token = login.body.accessToken;

    // The only lever this test uses to "expire" the trial is Postgres itself.
    await pool.query("UPDATE clinics SET trial_ends_at = NOW() - interval '1 minute' WHERE id = $1", [clinic.id]);

    const blocked = await request(app).get("/api/patients").set("Authorization", `Bearer ${token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/trial/i);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.clinic.trial_expired).toBe(true);
  });

  it("a non-trial clinic is never touched by requireTrialActive", async () => {
    const email = `nontrial-${ts}@t.pk`;
    const created = await request(app).post("/api/platform/clinics").set("Authorization", `Bearer ${asAdmin()}`).send({
      name: "Normal Clinic", slug: `normal-${ts}`, owner: { name: "Owner", email, password: "password1" },
    });
    createdClinicIds.push(created.body.clinic.id);
    createdUserIds.push(created.body.owner.id);
    expect(created.body.clinic.is_trial).toBe(false);

    const login = await request(app).post("/api/auth/login").send({ email, password: "password1" });
    expect(login.body.user.clinic.trial_expired).toBe(false);
    const ok = await request(app).get("/api/patients").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(ok.status).toBe(200);
  });

  it("a platform admin bypasses requireTrialActive entirely", async () => {
    const res = await request(app).get("/api/platform/clinics").set("Authorization", `Bearer ${asAdmin()}`);
    expect(res.status).toBe(200);
  });

  it("platform admin can convert a trial to paid: access restored, trial fields cleared", async () => {
    const { ownerEmail, clinic } = await createTrialClinic();
    await pool.query("UPDATE clinics SET trial_started_at = NOW() - interval '10 days', trial_ends_at = NOW() - interval '3 days' WHERE id = $1", [clinic.id]);
    const login = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    const blocked = await request(app).get("/api/patients").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(blocked.status).toBe(403);

    const converted = await request(app).patch(`/api/platform/clinics/${clinic.id}`).set("Authorization", `Bearer ${asAdmin()}`).send({ is_trial: false });
    expect(converted.body.clinic.is_trial).toBe(false);
    expect(converted.body.clinic.trial_ends_at).toBeNull();

    const ok = await request(app).get("/api/patients").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(ok.status).toBe(200);
  });

  it("platform admin can extend a started trial's clock", async () => {
    const { ownerEmail, clinic } = await createTrialClinic();
    const login = await request(app).post("/api/auth/login").send({ email: ownerEmail, password: "password1" });
    const before = new Date(login.body.user.clinic.trial_ends_at);

    const extended = await request(app).patch(`/api/platform/clinics/${clinic.id}`).set("Authorization", `Bearer ${asAdmin()}`).send({ extend_trial_days: 5 });
    const after = new Date(extended.body.clinic.trial_ends_at);
    expect(after.getTime() - before.getTime()).toBeCloseTo(5 * 86400000, -3);
  });

  it("extending an unstarted trial lengthens trial_days instead of touching trial_ends_at", async () => {
    const { clinic } = await createTrialClinic({ trial_days: 7 });
    const extended = await request(app).patch(`/api/platform/clinics/${clinic.id}`).set("Authorization", `Bearer ${asAdmin()}`).send({ extend_trial_days: 3 });
    expect(extended.body.clinic.trial_ends_at).toBeNull();
    expect(extended.body.clinic.trial_days).toBe(10);
  });

  it("rejects a non-positive trial_days on create", async () => {
    const res = await request(app).post("/api/platform/clinics").set("Authorization", `Bearer ${asAdmin()}`).send({
      name: "Bad", slug: `bad-${ts}`, is_trial: true, trial_days: 0,
      owner: { name: "X", email: `bad-${ts}@t.pk`, password: "password1" },
    });
    expect(res.status).toBe(400);
  });
});
