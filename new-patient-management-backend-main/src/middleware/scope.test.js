import { describe, it, expect, vi } from "vitest";
import { isAdmin, patientScope, assertPatientOwned, assertConsultationOwned } from "./scope.js";

const doctor = { id: 7, role: "doctor" };
const admin = { id: 1, role: "admin" };

// Fake pg client: records the calls, returns a canned rowCount.
const fakeClient = (rowCount) => {
  const calls = [];
  return {
    calls,
    query: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      return { rowCount, rows: rowCount ? [{ "?column?": 1 }] : [] };
    }),
  };
};

describe("isAdmin", () => {
  it("is true only for role 'admin'", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(doctor)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("patientScope", () => {
  it("returns an empty fragment for admins", () => {
    expect(patientScope(admin)).toEqual({ text: "", params: [] });
  });

  it("appends 'AND <column> = $N' with the caller id for doctors", () => {
    const s = patientScope(doctor, "p.doctor_id", 4);
    expect(s.text).toBe(" AND p.doctor_id = $4");
    expect(s.params).toEqual([7]);
  });
});

describe("assertPatientOwned", () => {
  it("does not filter by doctor_id for admins", async () => {
    const c = fakeClient(1);
    await expect(assertPatientOwned(99, admin, c)).resolves.toBeUndefined();
    expect(c.calls[0].sql).not.toMatch(/doctor_id/);
    expect(c.calls[0].params).toEqual([99]);
  });

  it("filters by the caller id for doctors and resolves when a row is found", async () => {
    const c = fakeClient(1);
    await expect(assertPatientOwned(42, doctor, c)).resolves.toBeUndefined();
    expect(c.calls[0].sql).toMatch(/doctor_id = \$2/);
    expect(c.calls[0].params).toEqual([42, 7]);
  });

  it("throws a 404 ApiError when the patient is not owned", async () => {
    const c = fakeClient(0);
    await expect(assertPatientOwned(42, doctor, c)).rejects.toMatchObject({
      statusCode: 404,
      message: "Patient not found",
    });
  });
});

describe("assertConsultationOwned", () => {
  it("joins through patients for doctors", async () => {
    const c = fakeClient(1);
    await assertConsultationOwned(5, doctor, c);
    expect(c.calls[0].sql).toMatch(/JOIN patients/i);
    expect(c.calls[0].params).toEqual([5, 7]);
  });

  it("throws 404 when the consultation's patient is not owned", async () => {
    const c = fakeClient(0);
    await expect(assertConsultationOwned(5, doctor, c)).rejects.toMatchObject({ statusCode: 404 });
  });
});
