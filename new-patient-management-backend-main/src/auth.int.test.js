// Integration test: rotating refresh-token auth flow against the real app +
// Postgres. Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("auth: rotating refresh tokens (integration)", () => {
  let request, app, pool, bcrypt;
  let clinic;
  const email = `auth-${Date.now()}@t.pk`;
  const password = "supersecret1";

  const cookieFrom = (res) => {
    const set = res.headers["set-cookie"] || [];
    const rt = set.find((c) => c.startsWith("rt="));
    return rt ? rt.split(";")[0] : null;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "y".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ default: app } = await import("./app.js"));
    ({ default: bcrypt } = await import("bcryptjs"));

    // /api/auth/register is platform-admin only now — seed the test account
    // directly, the same way a clinic's owner would already exist.
    const c = await pool.query(
      `INSERT INTO clinics (name, slug) VALUES ('Auth Test Clinic', 'auth-test-${Date.now()}') RETURNING id`
    );
    clinic = c.rows[0].id;
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ('Auth Tester',$1,$2,'','doctor',$3,true)`,
      [email, hash, clinic]
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM auth_users WHERE email = $1", [email]);
    await pool.query("DELETE FROM clinics WHERE id = $1", [clinic]);
    await pool.end();
  });

  it("login returns a short access token and sets an httpOnly refresh cookie", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body).not.toHaveProperty("token"); // old field gone
    const setCookie = (res.headers["set-cookie"] || []).join(";");
    expect(setCookie).toMatch(/rt=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it("refresh rotates the cookie and returns a new access token", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const c1 = cookieFrom(login);

    const r = await request(app).post("/api/auth/refresh").set("Cookie", c1);
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();
    const c2 = cookieFrom(r);
    expect(c2).toBeTruthy();
    expect(c2).not.toBe(c1); // rotated
  });

  it("reusing a rotated refresh token is rejected and revokes the family", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const c1 = cookieFrom(login);

    const first = await request(app).post("/api/auth/refresh").set("Cookie", c1);
    expect(first.status).toBe(200);
    const c2 = cookieFrom(first);

    // Replay the old cookie — theft signal.
    const replay = await request(app).post("/api/auth/refresh").set("Cookie", c1);
    expect(replay.status).toBe(401);

    // The freshly issued token is now dead too (family revoked).
    const afterNuke = await request(app).post("/api/auth/refresh").set("Cookie", c2);
    expect(afterNuke.status).toBe(401);
  });

  it("logout revokes the current token", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const c1 = cookieFrom(login);

    const out = await request(app).post("/api/auth/logout").set("Cookie", c1);
    expect(out.status).toBe(200);

    const after = await request(app).post("/api/auth/refresh").set("Cookie", c1);
    expect(after.status).toBe(401);
  });

  it("the refresh cookie's Secure flag follows the request, not NODE_ENV", async () => {
    // Regression test: the cookie used to key Secure off process.env.NODE_ENV.
    // A misconfigured NODE_ENV=production in local dev (a real incident — see
    // the fix commit) made every login's Set-Cookie carry Secure, which a
    // browser silently drops over plain http://localhost — the refresh cookie
    // never persisted and every reload bounced back to the login screen.
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const plain = await request(app).post("/api/auth/login").send({ email, password });
      const plainCookie = (plain.headers["set-cookie"] || []).find((c) => c.startsWith("rt="));
      expect(plainCookie).toBeTruthy();
      expect(plainCookie).not.toMatch(/;\s*Secure/i);

      // ... and the cookie that was actually set still works for refresh.
      const refreshed = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", plainCookie.split(";")[0]);
      expect(refreshed.status).toBe(200);

      // Behind Vercel's proxy (X-Forwarded-Proto: https), it must be Secure.
      const viaProxy = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-Proto", "https")
        .send({ email, password });
      const proxyCookie = (viaProxy.headers["set-cookie"] || []).find((c) => c.startsWith("rt="));
      expect(proxyCookie).toMatch(/;\s*Secure/i);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it("login is rate-limited after repeated failures", async () => {
    const bad = { email, password: "wrong" };
    let sawLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(app).post("/api/auth/login").send(bad);
      if (res.status === 429) { sawLimit = true; break; }
    }
    expect(sawLimit).toBe(true);
  });
});
