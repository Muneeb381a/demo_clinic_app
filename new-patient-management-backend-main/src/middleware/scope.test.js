import { describe, it, expect, vi } from "vitest";
import { isPlatformAdmin, clinicScope, assertPatientOwned, assertConsultationOwned } from "./scope.js";

const doctor = { id: 7, clinic_id: 3, role: "doctor" };
const receptionist = { id: 8, clinic_id: 3, role: "receptionist" };
const platformAdmin = { id: 1, clinic_id: null, role: "platform_admin" };

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

describe("isPlatformAdmin", () => {
  it("is true only for role 'platform_admin'", () => {
    expect(isPlatformAdmin(platformAdmin)).toBe(true);
    expect(isPlatformAdmin(doctor)).toBe(false);
    expect(isPlatformAdmin(receptionist)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
  });
});

describe("clinicScope", () => {
  it("returns an empty fragment for platform admins", () => {
    expect(clinicScope(platformAdmin)).toEqual({ text: "", params: [] });
  });

  it("appends 'AND <column> = $N' with the caller's clinic id for staff", () => {
    const s = clinicScope(doctor, "p.clinic_id", 4);
    expect(s.text).toBe(" AND p.clinic_id = $4");
    expect(s.params).toEqual([3]);
  });

  it("scopes a receptionist the same as a doctor in the same clinic", () => {
    expect(clinicScope(receptionist, "p.clinic_id", 2)).toEqual(clinicScope(doctor, "p.clinic_id", 2));
  });
});

describe("assertPatientOwned", () => {
  it("does not filter by clinic_id for platform admins", async () => {
    const c = fakeClient(1);
    await expect(assertPatientOwned(99, platformAdmin, c)).resolves.toBeUndefined();
    expect(c.calls[0].sql).not.toMatch(/clinic_id/);
    expect(c.calls[0].params).toEqual([99]);
  });

  it("filters by the caller's clinic id and resolves when a row is found", async () => {
    const c = fakeClient(1);
    await expect(assertPatientOwned(42, doctor, c)).resolves.toBeUndefined();
    expect(c.calls[0].sql).toMatch(/clinic_id = \$2/);
    expect(c.calls[0].params).toEqual([42, 3]);
  });

  it("throws a 404 ApiError when the patient is not in the caller's clinic", async () => {
    const c = fakeClient(0);
    await expect(assertPatientOwned(42, doctor, c)).rejects.toMatchObject({
      statusCode: 404,
      message: "Patient not found",
    });
  });

  it("a receptionist in the same clinic can see the same patient a doctor can", async () => {
    const c = fakeClient(1);
    await expect(assertPatientOwned(42, receptionist, c)).resolves.toBeUndefined();
    expect(c.calls[0].params).toEqual([42, 3]);
  });
});

describe("assertConsultationOwned", () => {
  it("joins through patients on clinic_id for clinic staff", async () => {
    const c = fakeClient(1);
    await assertConsultationOwned(5, doctor, c);
    expect(c.calls[0].sql).toMatch(/JOIN patients/i);
    expect(c.calls[0].sql).toMatch(/clinic_id = \$2/);
    expect(c.calls[0].params).toEqual([5, 3]);
  });

  it("throws 404 when the consultation's patient is outside the caller's clinic", async () => {
    const c = fakeClient(0);
    await expect(assertConsultationOwned(5, doctor, c)).rejects.toMatchObject({ statusCode: 404 });
  });
});
