import { describe, it, expect } from "vitest";
import { previewTotals, formatMoney, toPaisa } from "./billing";

describe("billing helpers", () => {
  it("sums lines with quantities without float drift", () => {
    const t = previewTotals([{ unit: 0.1, qty: 3 }, { unit: 0.2, qty: 1 }], 0);
    expect(t.subtotal).toBe(0.5);
    expect(toPaisa("1500.50")).toBe(150050);
  });

  it("clamps the discount to the subtotal and never goes negative", () => {
    expect(previewTotals([{ unit: 1000, qty: 1 }], 5000).total).toBe(0);
    expect(previewTotals([{ unit: 1000, qty: 1 }], -50).total).toBe(1000);
    expect(previewTotals([{ unit: 1000, qty: 2 }], 250).total).toBe(1750);
  });

  it("formats rupees", () => {
    expect(formatMoney(1500)).toContain("1,500");
    expect(formatMoney(undefined)).toBe("Rs 0");
  });
});
