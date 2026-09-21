// Integration test: wards, beds, admissions, transfer, discharge (Phase 2).
// Gated on INTEGRATION_DB_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DB = process.env.INTEGRATION_DB_URL;
const run = DB ? describe : describe.skip;

run("ipd (integration)", () => {
  let request, app, pool, signToken;
  const ids = { clinics: [], users: [], patients: [] };
  let A, ownerTok, recepTok, otherTok, offTok, docId, pat1, pat2, pat3, otherPat;
  let wardId, bedIds;
  const ts = Date.now();

  const mkUser = async (name, role, clinicId, isOwner = false) => {
    const r = await pool.query(
      `INSERT INTO auth_users (name,email,password_hash,salt,role,clinic_id,is_owner)
       VALUES ($1,$2,'x','',$3,$4,$5) RETURNING id`,
      [name, `${name}-${ts}-${Math.random().toString(36).slice(2, 6)}@t.pk`, role, clinicId, isOwner]
    );
    ids.users.push(r.rows[0].id);
    return r.rows[0].id;
  };
  const mkClinic = async (slug, features) => {
    const r = await pool.query("INSERT INTO clinics (name, slug, features) VALUES ($1,$2,$3) RETURNING id", [slug, `${slug}-${ts}`, JSON.stringify(features)]);
    ids.clinics.push(r.rows[0].id);
    return r.rows[0].id;
  };
  const mkPatient = async (name, clinic, doctor) => {
    const p = await pool.query(
      "INSERT INTO patients (name, mobile, mr_no, clinic_id, doctor_id) VALUES ($1,'03001234567',$2,$3,$4) RETURNING id",
      [name, `MR-${ts}-${name}`, clinic, doctor]
    );
    ids.patients.push(p.rows[0].id);
    return p.rows[0].id;
  };
  const tok = (id, role, clinic, owner = false) => signToken({ id, email: "x@t.pk", role, clinic_id: clinic, is_owner: owner });
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "u".repeat(48);
    ({ default: request } = await import("supertest"));
    ({ pool } = await import("./models/db.js"));
    ({ signToken } = await import("./middleware/auth.js"));
    ({ default: app } = await import("./app.js"));

    A = await mkClinic("ipd-a", { ipd: true });
    const B = await mkClinic("ipd-b", { ipd: true });
    const Off = await mkClinic("ipd-off", { ipd: false });
    const owner = await mkUser("owner", "doctor", A, true);
    docId = owner;
    const recep = await mkUser("recep", "receptionist", A);
    const otherOwner = await mkUser("otherowner", "doctor", B, true);
    const offOwner = await mkUser("offowner", "doctor", Off, true);
    ownerTok = tok(owner, "doctor", A, true);
    recepTok = tok(recep, "receptionist", A);
    otherTok = tok(otherOwner, "doctor", B, true);
    offTok = tok(offOwner, "doctor", Off, true);
    pat1 = await mkPatient("p1", A, owner);
    pat2 = await mkPatient("p2", A, owner);
    pat3 = await mkPatient("p3", A, owner);
    otherPat = await mkPatient("px", B, otherOwner);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM bed_stays WHERE admission_id IN (SELECT id FROM admissions WHERE clinic_id = ANY($1))", [ids.clinics]);
    await pool.query("DELETE FROM admissions WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM beds WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM wards WHERE clinic_id = ANY($1)", [ids.clinics]);
    await pool.query("DELETE FROM patients WHERE id = ANY($1)", [ids.patients]);
    await pool.query("DELETE FROM auth_users WHERE id = ANY($1)", [ids.users]);
    await pool.query("DELETE FROM clinics WHERE id = ANY($1)", [ids.clinics]);
    await pool.end();
  });

  it("blocks a clinic without the ipd feature", async () => {
    expect((await request(app).get("/api/ipd/beds").set(auth(offTok))).status).toBe(403);
  });

  it("only the owner sets up wards and beds; numbering continues", async () => {
    const denied = await request(app).post("/api/ipd/wards").set(auth(recepTok)).send({ name: "General", daily_rate: 2000 });
    expect(denied.status).toBe(403);
    const w = await request(app).post("/api/ipd/wards").set(auth(ownerTok)).send({ name: "General", ward_type: "general", daily_rate: 2000 });
    expect(w.status).toBe(201);
    wardId = w.body.ward.id;
    const dup = await request(app).post("/api/ipd/wards").set(auth(ownerTok)).send({ name: "General", daily_rate: 1 });
    expect(dup.status).toBe(409);

    const b1 = await request(app).post(`/api/ipd/wards/${wardId}/beds`).set(auth(ownerTok)).send({ count: 3, prefix: "G-" });
    expect(b1.body.beds.map((b) => b.bed_no)).toEqual(["G-1", "G-2", "G-3"]);
    const b2 = await request(app).post(`/api/ipd/wards/${wardId}/beds`).set(auth(ownerTok)).send({ count: 1, prefix: "G-" });
    expect(b2.body.beds[0].bed_no).toBe("G-4");
    bedIds = [...b1.body.beds, ...b2.body.beds].map((b) => b.id);

    const otherWard = await request(app).post(`/api/ipd/wards/${wardId}/beds`).set(auth(otherTok)).send({ count: 1 });
    expect(otherWard.status).toBe(404);

    const board = await request(app).get("/api/ipd/beds").set(auth(recepTok));
    expect(board.body.counts).toMatchObject({ total: 4, available: 4, occupied: 0 });
  });

  let adm1;
  it("admits a patient: bed becomes occupied, rate snapshotted, number assigned", async () => {
    const res = await request(app).post("/api/ipd/admissions").set(auth(recepTok))
      .send({ patient_id: pat1, bed_id: bedIds[0], doctor_id: docId, diagnosis: "Stroke" });
    expect(res.status).toBe(201);
    expect(res.body.admission.admission_no).toBe("ADM-000001");
    adm1 = res.body.admission.id;

    const board = await request(app).get("/api/ipd/beds").set(auth(recepTok));
    const bed = board.body.beds.find((b) => b.id === bedIds[0]);
    expect(bed.status).toBe("occupied");
    expect(bed.patient_name).toBe("p1");
    const detail = await request(app).get(`/api/ipd/admissions/${adm1}`).set(auth(recepTok));
    expect(Number(detail.body.stays[0].daily_rate)).toBe(2000);
  });

  it("rejects an occupied bed, a double admission, and cross-clinic patients", async () => {
    const occupied = await request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: pat2, bed_id: bedIds[0] });
    expect(occupied.status).toBe(409);
    const twice = await request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: pat1, bed_id: bedIds[1] });
    expect(twice.status).toBe(409);
    const foreign = await request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: otherPat, bed_id: bedIds[1] });
    expect(foreign.status).toBe(404);
    const board = await request(app).get("/api/ipd/beds").set(auth(recepTok));
    expect(board.body.beds.find((b) => b.id === bedIds[1]).status).toBe("available"); // rolled back cleanly
  });

  it("two simultaneous admissions into one bed: exactly one wins", async () => {
    const [x, y] = await Promise.all([
      request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: pat2, bed_id: bedIds[1] }),
      request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: pat3, bed_id: bedIds[1] }),
    ]);
    expect([x.status, y.status].sort()).toEqual([201, 409]);
    // free it again for the next tests
    const winner = x.status === 201 ? x : y;
    await request(app).post(`/api/ipd/admissions/${winner.body.admission.id}/discharge`).set(auth(recepTok)).send({});
    await request(app).put(`/api/ipd/beds/${bedIds[1]}/status`).set(auth(recepTok)).send({ status: "available" });
  });

  it("transfers to a free bed: old bed cleaning, new bed occupied, history kept", async () => {
    const t = await request(app).post(`/api/ipd/admissions/${adm1}/transfer`).set(auth(recepTok)).send({ bed_id: bedIds[2] });
    expect(t.status).toBe(200);
    const board = await request(app).get("/api/ipd/beds").set(auth(recepTok));
    expect(board.body.beds.find((b) => b.id === bedIds[0]).status).toBe("cleaning");
    expect(board.body.beds.find((b) => b.id === bedIds[2]).status).toBe("occupied");
    const detail = await request(app).get(`/api/ipd/admissions/${adm1}`).set(auth(recepTok));
    expect(detail.body.stays).toHaveLength(2);
    expect(detail.body.stays[0].to_at).not.toBeNull();
    expect(detail.body.stays[1].to_at).toBeNull();
    const same = await request(app).post(`/api/ipd/admissions/${adm1}/transfer`).set(auth(recepTok)).send({ bed_id: bedIds[2] });
    expect(same.status).toBe(400);
  });

  it("staff move beds through cleaning → available, but never set 'occupied' by hand", async () => {
    const bad = await request(app).put(`/api/ipd/beds/${bedIds[0]}/status`).set(auth(recepTok)).send({ status: "occupied" });
    expect(bad.status).toBe(400);
    const ok = await request(app).put(`/api/ipd/beds/${bedIds[0]}/status`).set(auth(recepTok)).send({ status: "available" });
    expect(ok.body.bed.status).toBe("available");
    const occ = await request(app).put(`/api/ipd/beds/${bedIds[2]}/status`).set(auth(recepTok)).send({ status: "available" });
    expect(occ.status).toBe(404); // occupied bed can't be flipped
  });

  it("discharges: stay closed, bed to cleaning, second discharge rejected", async () => {
    const d = await request(app).post(`/api/ipd/admissions/${adm1}/discharge`).set(auth(recepTok)).send({ discharge_summary: "Recovered" });
    expect(d.body.admission.status).toBe("discharged");
    const board = await request(app).get("/api/ipd/beds").set(auth(recepTok));
    expect(board.body.beds.find((b) => b.id === bedIds[2]).status).toBe("cleaning");
    const again = await request(app).post(`/api/ipd/admissions/${adm1}/discharge`).set(auth(recepTok)).send({});
    expect(again.status).toBe(409);
    const list = await request(app).get("/api/ipd/admissions?status=admitted").set(auth(recepTok));
    expect(list.body.admissions.find((a) => a.id === adm1)).toBeUndefined();
  });

  it("a discharged patient can be admitted again; other clinics can't see admissions", async () => {
    const re = await request(app).post("/api/ipd/admissions").set(auth(recepTok)).send({ patient_id: pat1, bed_id: bedIds[0] });
    expect(re.status).toBe(201);
    const peek = await request(app).get(`/api/ipd/admissions/${adm1}`).set(auth(otherTok));
    expect(peek.status).toBe(404);
  });
});
