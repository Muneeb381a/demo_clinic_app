// Money helpers for the billing screens. Amounts are handled as integer paisa
// to avoid float drift; the server recomputes everything authoritatively —
// this is only for the live preview and formatting.

export const toPaisa = (v) => Math.round((Number(v) || 0) * 100);

export const formatMoney = (v) =>
  `Rs ${(Number(v) || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** lines: [{ unit, qty }] (unit in rupees). Returns rupee values, discount clamped to the subtotal. */
export const previewTotals = (lines, discount) => {
  const subtotal = lines.reduce((s, l) => s + toPaisa(l.unit) * (l.qty || 1), 0);
  const disc = Math.min(Math.max(toPaisa(discount), 0), subtotal);
  return { subtotal: subtotal / 100, discount: disc / 100, total: (subtotal - disc) / 100 };
};

export const statusStyle = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  unpaid: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  void: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};
