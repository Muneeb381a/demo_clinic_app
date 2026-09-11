// Integration test: GET /api/public/clinics/by-slug/:slug — unauthenticated
// branding lookup used by the login page's subdomain support.
// Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("public clinic branding lookup (integration)", () => {
  let request, app, pool;
  let activeClinicId, suspendedClinicId;
  const activeSlug = `pub-active-${Date.now()}`;
  const suspendedSlug = `pub-suspended-${Date.now()}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "u".repeat(48);

    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ default: app } = await import("./app.js"));

    const active = await pool.query(
      `INSERT INTO clinics (name, slug, status) VALUES ('Active Clinic', $1, 'active') RETURNING id`,
      [activeSlug]
    );
    activeClinicId = active.rows[0].id;

    const suspended = await pool.query(
      `INSERT INTO clinics (name, slug, status) VALUES ('Suspended Clinic', $1, 'suspended') RETURNING id`,
      [suspendedSlug]
    );
    suspendedClinicId = suspended.rows[0].id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [[activeClinicId, suspendedClinicId]]);
    await pool.end();
  });

  it("returns name and slug for an active clinic, no auth required", async () => {
    const res = await request(app).get(`/api/public/clinics/by-slug/${activeSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.clinic).toEqual({ name: "Active Clinic", slug: activeSlug });
  });

  it("404s for a suspended clinic — doesn't leak that the slug exists", async () => {
    const res = await request(app).get(`/api/public/clinics/by-slug/${suspendedSlug}`);
    expect(res.status).toBe(404);
  });

  it("404s for a slug that doesn't exist", async () => {
    const res = await request(app).get(`/api/public/clinics/by-slug/no-such-clinic-${Date.now()}`);
    expect(res.status).toBe(404);
  });

  it("404s for a malformed slug instead of erroring", async () => {
    const res = await request(app).get(`/api/public/clinics/by-slug/${encodeURIComponent("Not A Slug!")}`);
    expect(res.status).toBe(404);
  });
});
