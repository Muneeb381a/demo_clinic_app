import React, { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../utils/axiosClient";
import { getUser } from "../utils/auth";
import { formatMoney, previewTotals, statusStyle } from "../utils/billing";

const input =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm";
const card = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6";
const btn = "text-sm font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-lg transition-colors";

// ── Receipt (also the print layout) ──────────────────────────────────────────
const Receipt = ({ data, onClose, onPay }) => {
  const { bill, items, payments } = data;
  const balance = Number(bill.total) - Number(bill.paid);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [error, setError] = useState("");

  const pay = async () => {
    setError("");
    try {
      await onPay(bill.id, { amount: Number(amount), method });
      setAmount("");
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <style>{`@media print { body * { visibility: hidden; } #receipt, #receipt * { visibility: visible; } #receipt { position: absolute; inset: 0; box-shadow: none; } .no-print { display: none !important; } }`}</style>
      <div className="w-full max-w-md">
        <div id="receipt" className="bg-white text-gray-900 rounded-2xl shadow-xl p-6 text-sm">
          <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
            <h2 className="text-lg font-bold">{bill.clinic_name}</h2>
            <p className="text-xs text-gray-500">Payment Receipt</p>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs mb-3">
            <span className="text-gray-500">Bill No</span><span className="text-right font-medium">{bill.bill_no}</span>
            <span className="text-gray-500">Date</span><span className="text-right">{new Date(bill.created_at).toLocaleString("en-PK")}</span>
            <span className="text-gray-500">Patient</span><span className="text-right">{bill.patient_name}</span>
            <span className="text-gray-500">MR No</span><span className="text-right">{bill.mr_no || "—"}</span>
            <span className="text-gray-500">Received by</span><span className="text-right">{bill.created_by_name || "—"}</span>
          </div>
          <table className="w-full text-xs mb-3">
            <thead><tr className="border-y border-gray-300 text-left"><th className="py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}><td className="py-1 pr-2">{i.description}</td><td className="text-right">{i.qty}</td><td className="text-right">{formatMoney(i.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 text-xs border-t border-gray-300 pt-2">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(bill.subtotal)}</span></div>
            {Number(bill.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>- {formatMoney(bill.discount)}</span></div>}
            <div className="flex justify-between font-bold text-sm"><span>Total</span><span>{formatMoney(bill.total)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span>{formatMoney(bill.paid)}</span></div>
            <div className="flex justify-between font-semibold"><span>Balance due</span><span>{formatMoney(balance)}</span></div>
          </div>
          {payments.length > 0 && (
            <p className="text-[11px] text-gray-500 mt-2">
              Payments: {payments.map((p) => `${formatMoney(p.amount)} (${p.method})`).join(", ")}
            </p>
          )}
          <p className="text-center text-[11px] text-gray-400 mt-4">Thank you — get well soon.</p>
          {bill.status === "void" && <p className="text-center font-bold text-red-600 mt-2">VOID</p>}
        </div>

        <div className="no-print mt-3 bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3">
          {balance > 0 && bill.status !== "void" && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label htmlFor="pay-amount" className="block text-xs text-gray-500 mb-1">Collect payment (balance {formatMoney(balance)})</label>
                <input id="pay-amount" type="number" min={0} className={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <select aria-label="Payment method" className={`${input} w-24`} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option>
              </select>
              <button className={btn} onClick={pay} disabled={!Number(amount)}>Collect</button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => window.print()} className={btn}>Print</button>
            <button onClick={onClose} className="text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── New bill ─────────────────────────────────────────────────────────────────
const NewBill = ({ doctors, services, onCreated }) => {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [patient, setPatient] = useState(null);
  const [searchMsg, setSearchMsg] = useState("");
  const [picked, setPicked] = useState({}); // "consultation:12" -> true
  const [svcQty, setSvcQty] = useState({}); // serviceId -> qty
  const [discount, setDiscount] = useState("");
  const [payNow, setPayNow] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = async (e) => {
    e.preventDefault();
    setSearchMsg("");
    setMatches([]);
    const q = query.trim();
    if (!q) return;
    const param = /^[0-9]{10,11}$/.test(q) ? "mobile" : "name";
    try {
      const { data } = await apiClient.get(`/api/patients/search?${param}=${encodeURIComponent(q)}`);
      if (!data.exists) return setSearchMsg("No patient found");
      const list = Array.isArray(data.data) ? data.data : [data.data];
      setMatches(list);
    } catch (err) {
      setSearchMsg(err.response?.data?.message || "Search failed");
    }
  };

  const lines = useMemo(() => {
    const out = [];
    for (const d of doctors) {
      if (picked[`consultation:${d.doctor_id}`]) out.push({ unit: d.consultation_fee, qty: 1 });
      if (picked[`followup:${d.doctor_id}`]) out.push({ unit: d.followup_fee, qty: 1 });
    }
    for (const s of services) if (svcQty[s.id] > 0) out.push({ unit: s.price, qty: svcQty[s.id] });
    return out;
  }, [doctors, services, picked, svcQty]);
  const totals = previewTotals(lines, discount);

  const submit = async () => {
    setSaving(true);
    setError("");
    const items = [];
    for (const d of doctors) {
      if (picked[`consultation:${d.doctor_id}`]) items.push({ type: "consultation", doctor_id: d.doctor_id });
      if (picked[`followup:${d.doctor_id}`]) items.push({ type: "followup", doctor_id: d.doctor_id });
    }
    for (const s of services) if (svcQty[s.id] > 0) items.push({ type: "service", service_id: s.id, qty: svcQty[s.id] });
    try {
      const { data } = await apiClient.post("/api/billing/bills", {
        patient_id: patient.id, items, discount: Number(discount) || 0,
        payment: Number(payNow) > 0 ? { amount: Number(payNow), method } : undefined,
      });
      onCreated(data.bill.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create bill");
    } finally {
      setSaving(false);
    }
  };

  const configured = doctors.filter((d) => d.configured);

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">New bill</h2>

      {!patient ? (
        <>
          <form onSubmit={search} className="flex gap-2 mb-3">
            <input aria-label="Search patient" className={input} placeholder="Patient name or mobile number"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className={btn} type="submit">Find</button>
          </form>
          {searchMsg && <p className="text-sm text-gray-500">{searchMsg}</p>}
          <ul className="space-y-2">
            {matches.map((p) => (
              <li key={p.id}>
                <button onClick={() => setPatient(p)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-teal-300 text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-100">{p.name}</span>
                  <span className="text-gray-400"> · {p.mobile}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span><span className="text-gray-500">Patient:</span> <b className="text-gray-800 dark:text-gray-100">{patient.name}</b> · {patient.mobile}</span>
            <button onClick={() => setPatient(null)} className="text-xs text-teal-700 hover:underline">Change</button>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Doctor fees</p>
            {configured.length === 0 ? (
              <p className="text-sm text-gray-500">No doctor fees are set yet — the clinic owner can add them under Fees.</p>
            ) : configured.map((d) => (
              <div key={d.doctor_id} className="flex flex-wrap items-center gap-4 text-sm py-1 text-gray-700 dark:text-gray-200">
                <span className="w-40">Dr. {d.name}</span>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!picked[`consultation:${d.doctor_id}`]}
                    onChange={(e) => setPicked({ ...picked, [`consultation:${d.doctor_id}`]: e.target.checked })} />
                  Consultation {formatMoney(d.consultation_fee)}
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!picked[`followup:${d.doctor_id}`]}
                    onChange={(e) => setPicked({ ...picked, [`followup:${d.doctor_id}`]: e.target.checked })} />
                  Follow-up {formatMoney(d.followup_fee)}
                </label>
              </div>
            ))}
          </div>

          {services.filter((s) => s.active).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Services</p>
              {services.filter((s) => s.active).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm py-1 text-gray-700 dark:text-gray-200">
                  <span>{s.name} <span className="text-gray-400">· {formatMoney(s.price)}</span></span>
                  <input aria-label={`Quantity of ${s.name}`} type="number" min={0} className={`${input} w-20`}
                    value={svcQty[s.id] || ""} placeholder="0"
                    onChange={(e) => setSvcQty({ ...svcQty, [s.id]: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="bill-discount" className="block text-xs text-gray-500 mb-1">Discount (Rs)</label>
              <input id="bill-discount" type="number" min={0} className={input} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bill-paynow" className="block text-xs text-gray-500 mb-1">Receive now (Rs)</label>
              <input id="bill-paynow" type="number" min={0} className={input} value={payNow} onChange={(e) => setPayNow(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bill-method" className="block text-xs text-gray-500 mb-1">Method</label>
              <select id="bill-method" className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option>
              </select>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white" data-testid="bill-total">{formatMoney(totals.total)}</div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={btn} onClick={submit} disabled={saving || lines.length === 0}>
            {saving ? "Creating…" : "Create bill & receipt"}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const BillingPage = () => {
  const [bills, setBills] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const isOwner = Boolean(getUser()?.is_owner);

  const load = useCallback(async () => {
    try {
      const [b, d, s, t] = await Promise.all([
        apiClient.get("/api/billing/bills"), apiClient.get("/api/billing/doctors"),
        apiClient.get("/api/billing/services"), apiClient.get("/api/billing/summary/today"),
      ]);
      setBills(b.data.bills || []);
      setDoctors(d.data.doctors || []);
      setServices(s.data.services || []);
      setSummary(t.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load billing");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReceipt = async (id) => {
    const { data } = await apiClient.get(`/api/billing/bills/${id}`);
    setReceipt(data);
  };

  const collect = async (id, payload) => {
    await apiClient.post(`/api/billing/bills/${id}/payments`, payload);
    await openReceipt(id);
    load();
  };

  const voidBill = async (id) => {
    if (!window.confirm("Void this bill? This cannot be undone.")) return;
    try {
      await apiClient.post(`/api/billing/bills/${id}/void`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to void bill");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create bills, collect fees and print receipts.</p>
          </div>
          {summary && (
            <div className="text-right">
              <div className="text-xs text-gray-500">Collected today</div>
              <div className="text-xl font-bold text-teal-700 dark:text-teal-400">{formatMoney(summary.collected)}</div>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <NewBill doctors={doctors} services={services}
          onCreated={async (id) => { await openReceipt(id); load(); }} />

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Recent bills</h2>
          {bills.length === 0 ? (
            <p className="text-sm text-gray-500">No bills yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-2 pr-3">Bill</th><th className="pr-3">Patient</th><th className="pr-3">Total</th>
                    <th className="pr-3">Paid</th><th className="pr-3">Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{b.bill_no}</td>
                      <td className="pr-3">{b.patient_name}</td>
                      <td className="pr-3">{formatMoney(b.total)}</td>
                      <td className="pr-3">{formatMoney(b.paid)}</td>
                      <td className="pr-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[b.status]}`}>{b.status}</span></td>
                      <td className="whitespace-nowrap">
                        <button onClick={() => openReceipt(b.id)} className="text-xs text-teal-700 hover:underline mr-3">Receipt</button>
                        {isOwner && b.status !== "void" && (
                          <button onClick={() => voidBill(b.id)} className="text-xs text-rose-600 hover:underline">Void</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} onPay={collect} />}
    </div>
  );
};

export default BillingPage;
