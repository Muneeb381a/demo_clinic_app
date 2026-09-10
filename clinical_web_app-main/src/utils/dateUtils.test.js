import { describe, it, expect } from "vitest";
import { urduDate } from "./dateUtils";

describe("urduDate", () => {
  it("accepts both a Date object and an ISO string", () => {
    expect(() => urduDate(new Date("2026-01-15"))).not.toThrow();
    expect(() => urduDate("2026-01-15")).not.toThrow();
  });

  it("returns a non-empty formatted string, not the raw input", () => {
    const out = urduDate("2026-01-15");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe("2026-01-15");
  });

  it("formats the same instant identically on repeat calls", () => {
    const d = "2026-06-01T12:00:00Z";
    expect(urduDate(d)).toBe(urduDate(d));
  });
});
