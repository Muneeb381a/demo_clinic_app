import { describe, it, expect, vi } from "vitest";
import {
  validate,
  createPatientSchema,
  loginSchema,
  registerSchema,
  recordVitalsSchema,
} from "./validate.js";

// Build a fake Express req/res/next trio.
const mockCtx = (body) => {
  const req = { body };
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.payload = obj;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res, next };
};

describe("validate() middleware", () => {
  it("calls next() and replaces req.body with parsed data on success", () => {
    const { req, res, next } = mockCtx({
      name: "Ada Lovelace",
      mobile: "+923001234567",
      age: "42", // string — should be coerced
    });

    validate(createPatientSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
    expect(req.body.age).toBe(42); // coerced to number
  });

  it("responds 400 with a field error list on failure", () => {
    const { req, res, next } = mockCtx({ name: "", mobile: "abc" });

    validate(createPatientSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
    expect(Array.isArray(res.payload.errors)).toBe(true);
    const fields = res.payload.errors.map((e) => e.field);
    expect(fields).toContain("name");
    expect(fields).toContain("mobile");
  });

  it("strips unknown keys from the parsed body", () => {
    const { req, res, next } = mockCtx({
      name: "Grace Hopper",
      mobile: "03001234567",
      is_admin: true, // not in schema
    });

    validate(createPatientSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).not.toHaveProperty("is_admin");
  });
});

describe("createPatientSchema", () => {
  it("accepts a bare 10–15 digit mobile and an optional leading +", () => {
    expect(createPatientSchema.safeParse({ name: "A", mobile: "0300123456" }).success).toBe(true);
    expect(createPatientSchema.safeParse({ name: "A", mobile: "+923001234567" }).success).toBe(true);
  });

  it("rejects mobiles that are too short, too long, or non-numeric", () => {
    expect(createPatientSchema.safeParse({ name: "A", mobile: "12345" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ name: "A", mobile: "1234567890123456" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ name: "A", mobile: "+92-300-1234567" }).success).toBe(false);
  });

  it("normalises gender casing and the 'others' variant", () => {
    expect(createPatientSchema.parse({ name: "A", mobile: "0300123456", gender: "Male" }).gender).toBe("male");
    expect(createPatientSchema.parse({ name: "A", mobile: "0300123456", gender: "OTHERS" }).gender).toBe("other");
  });

  it("rejects an out-of-range age", () => {
    expect(createPatientSchema.safeParse({ name: "A", mobile: "0300123456", age: 200 }).success).toBe(false);
    expect(createPatientSchema.safeParse({ name: "A", mobile: "0300123456", age: -1 }).success).toBe(false);
  });
});

describe("auth schemas", () => {
  it("loginSchema requires a valid email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "no-at-sign", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "doc@clinic.pk", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "doc@clinic.pk", password: "x" }).success).toBe(true);
  });

  it("registerSchema enforces an 8-character minimum password", () => {
    const base = { name: "Dr Who", email: "who@clinic.pk" };
    expect(registerSchema.safeParse({ ...base, password: "short7!" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "longenough" }).success).toBe(true);
  });
});

describe("recordVitalsSchema", () => {
  const ids = { consultation_id: 1, patient_id: 1 };

  it("accepts physiologically plausible vitals", () => {
    const r = recordVitalsSchema.safeParse({ ...ids, temperature: 37, spo2_level: 98, pulse_rate: 72 });
    expect(r.success).toBe(true);
  });

  it("rejects a temperature outside 30–45 °C and SpO2 above 100", () => {
    expect(recordVitalsSchema.safeParse({ ...ids, temperature: 50 }).success).toBe(false);
    expect(recordVitalsSchema.safeParse({ ...ids, spo2_level: 120 }).success).toBe(false);
  });

  it("requires positive integer ids", () => {
    expect(recordVitalsSchema.safeParse({ consultation_id: 0, patient_id: 1 }).success).toBe(false);
  });
});
