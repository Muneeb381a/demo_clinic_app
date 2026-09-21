// src/utils/money.js
// Money is handled as integer paisa in JS (never floats) and stored as
// NUMERIC(12,2) in Postgres. pg returns NUMERIC as a string, so toPaisa()
// accepts both numbers and numeric strings.

export const toPaisa = (v) => {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) throw new Error("invalid amount");
  return Math.round(n * 100);
};

export const fromPaisa = (p) => (p / 100).toFixed(2);

/**
 * Split an amount between doctor and hospital. The doctor's part is rounded;
 * the hospital gets the remainder, so the two always add up to the amount.
 * `doctorPct` is 0-100.
 */
export const splitShare = (amountPaisa, doctorPct) => {
  const doctor = Math.round((amountPaisa * Number(doctorPct)) / 100);
  return { doctor, hospital: amountPaisa - doctor };
};

export const billStatus = (totalPaisa, paidPaisa) => {
  if (paidPaisa <= 0) return "unpaid";
  return paidPaisa >= totalPaisa ? "paid" : "partial";
};
