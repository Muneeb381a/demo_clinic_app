// Integration test: clinic-owner staff invites — issue, accept, seat limits,
// expiry/reuse rejection, removal. Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("clinic staff invites (integration)", () => {
  let request, app, pool, signToken, bcrypt;
  let clinic, ownerId, nonOwnerDoctorId, nonOwnerEmail;
  const nonOwnerPassword = "password1";

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "t".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));
    ({ default: bcrypt } = await import("bcryptjs"));

    // max_receptionists is 2 so the two separate accept-flow tests below each
    // get their own free seat; max_doctors stays at 2, exactly filled by the
    // owner + nonOwnerDoctor created here, so the seat-limit test below has
    // no doctor seats left without needing a third setup user.
    const c = await pool.query(
      `INSERT INTO clinics (name, slug, max_doctors, max_receptionists)
       VALUES ('Invite Test Clinic', 'invite-test-${Date.now()}', 2, 2) RETURNING id`
    );
    clinic = c.rows[0].id;

    const o = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ('Owner','owner-${Date.now()}@t.pk','x','','doctor',$1,true) RETURNING id`,
      [clinic]
    );
    ownerId = o.rows[0].id;

    // A second doctor already fills one of the two doctor seats — with a real
    // password so the removal test can prove their session actually dies.
    nonOwnerEmail = `seconddoc-${Date.now()}@t.pk`;
    const hash = await bcrypt.hash(nonOwnerPassword, 12);
    const d = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ('Second Doc',$1,$2,'','doctor',$3,false) RETURNING id`,
      [nonOwnerEmail, hash, clinic]
    );
    nonOwnerDoctorId = d.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM invites WHERE clinic_id = $1", [clinic]);
    await pool.query("DELETE FROM auth_users WHERE clinic_id = $1", [clinic]);
    await pool.query("DELETE FROM clinics WHERE id = $1", [clinic]);
    await pool.end();
  });

  const asOwner = () => signToken({ id: ownerId, email: "o@t.pk", role: "doctor", clinic_id: clinic, is_owner: true });
  const asNonOwner = () => signToken({ id: nonOwnerDoctorId, email: "d@t.pk", role: "doctor", clinic_id: clinic, is_owner: false });

  it("a non-owner cannot create an invite", async () => {
    const res = await request(app)
      .post("/api/clinic/invites")
      .set("Authorization", `Bearer ${asNonOwner()}`)
      .send({ email: "x@t.pk", role: "receptionist" });
    expect(res.status).toBe(403);
  });

  it("the owner can invite a receptionist, who can accept and log in", async () => {
    const email = `invitee-${Date.now()}@t.pk`;
    const created = await request(app)
      .post("/api/clinic/invites")
      .set("Authorization", `Bearer ${asOwner()}`)
      .send({ email, role: "receptionist" });
    expect(created.status).toBe(201);
    const token = created.body.invite.token;

    const preview = await request(app).get(`/api/auth/invite/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.invite.role).toBe("receptionist");
    expect(preview.body.invite.clinicName).toBe("Invite Test Clinic");

    const accepted = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token, name: "New Receptionist", password: "password1" });
    expect(accepted.status).toBe(201);
    expect(accepted.body.user.role).toBe("receptionist");
    expect(accepted.body.user.clinic_id).toBe(clinic);
    expect(accepted.body.user.is_owner).toBe(false);
    expect(accepted.body.accessToken).toBeTruthy();

    // The new receptionist can immediately log in with the password they set.
    const login = await request(app).post("/api/auth/login").send({ email, password: "password1" });
    expect(login.status).toBe(200);
  });

  it("reusing an already-accepted invite token is rejected", async () => {
    const email = `once-${Date.now()}@t.pk`;
    const created = await request(app)
      .post("/api/clinic/invites")
      .set("Authorization", `Bearer ${asOwner()}`)
      .send({ email, role: "receptionist" });
    const token = created.body.invite.token;

    const first = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token, name: "Once", password: "password1" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token, name: "Twice", password: "password1" });
    expect(second.status).toBe(404);
  });

  it("an unknown/garbage token is rejected", async () => {
    const res = await request(app).get("/api/auth/invite/not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("inviting beyond the seat limit is rejected", async () => {
    // max_doctors = 2; owner + nonOwnerDoctor already fill both seats.
    const res = await request(app)
      .post("/api/clinic/invites")
      .set("Authorization", `Bearer ${asOwner()}`)
      .send({ email: `overflow-${Date.now()}@t.pk`, role: "doctor" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/seat limit/i);
  });

  it("the owner can remove a staff member, whose active session dies immediately", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: nonOwnerEmail, password: nonOwnerPassword });
    expect(login.status).toBe(200);
    const refreshCookie = (login.headers["set-cookie"] || []).find((c) => c.startsWith("rt=")).split(";")[0];

    const remove = await request(app)
      .delete(`/api/clinic/staff/${nonOwnerDoctorId}`)
      .set("Authorization", `Bearer ${asOwner()}`);
    expect(remove.status).toBe(200);

    const check = await pool.query("SELECT id FROM auth_users WHERE id = $1", [nonOwnerDoctorId]);
    expect(check.rowCount).toBe(0);

    // Their refresh token was revoked as part of removal.
    const refreshAfter = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
    expect(refreshAfter.status).toBe(401);
  });

  it("an owner cannot remove their own account", async () => {
    const res = await request(app)
      .delete(`/api/clinic/staff/${ownerId}`)
      .set("Authorization", `Bearer ${asOwner()}`);
    expect(res.status).toBe(400);
  });
});
