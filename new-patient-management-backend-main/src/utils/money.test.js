import { describe, it, expect } from "vitest";
import { toPaisa, fromPaisa, splitShare, billStatus } from "./money.js";

describe("money", () => {
  it("converts numbers and pg numeric strings to integer paisa without float drift", () => {
    expect(toPaisa("1500.50")).toBe(150050);
    expect(toPaisa(0.1 + 0.2)).toBe(30);
    expect(fromPaisa(150050)).toBe("1500.50");
  });

  it("rejects non-numeric input", () => {
    expect(() => toPaisa("abc")).toThrow();
  });

  it("split always sums to the amount (doctor rounded, hospital = remainder)", () => {
    for (const [amt, pct] of [[100001, 33.33], [99999, 70], [1, 50], [123457, 12.5]]) {
      const s = splitShare(amt, pct);
      expect(s.doctor + s.hospital).toBe(amt);
    }
    expect(splitShare(100000, 70)).toEqual({ doctor: 70000, hospital: 30000 });
  });

  it("derives bill status from total vs paid", () => {
    expect(billStatus(1000, 0)).toBe("unpaid");
    expect(billStatus(1000, 400)).toBe("partial");
    expect(billStatus(1000, 1000)).toBe("paid");
  });
});
