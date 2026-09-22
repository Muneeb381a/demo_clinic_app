import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/axiosClient";
import { formatMoney } from "../utils/billing";
import { Receipt } from "./BillingPage";

const input =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm";
const card = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6";
const btn = "text-sm font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-lg transition-colors";
const smallBtn = "text-xs font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-3 py-1.5 rounded-lg";

const bedStyle = {
  available: "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700",
  occupied: "border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700",
  cleaning: "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700",
  maintenance: "border-gray-300 bg-gray-100 dark:bg-gray-700/40 dark:border-gray-600",
};

const Stat = ({ label, value, tone }) => (
  <div className="text-center">
    <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
  </div>
);

// ── Live running bill: room rent + charges so far, deposits, balance ────────
const RunningBill = ({ admissionId, doctors, services, refreshKey, onChanged, openReceipt }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [depAmount, setDepAmount] = useState("");
  const [depMethod, setDepMethod] = useState("cash");
  const [chargeType, setChargeType] = useState("visit");
  const [chargeDoctor, setChargeDoctor] = useState("");
  const [chargeService, setChargeService] = useState("");
  const [chargeQty, setChargeQty] = useState(1);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/api/ipd/admissions/${admissionId}/running-bill`);
      setData(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load running bill");
    }
  }, [admissionId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const addDeposit = async () => {
    setError("");
    try {
      await apiClient.post(`/api/ipd/admissions/${admissionId}/deposits`, { amount: Number(depAmount), method: depMethod });
      setDepAmount("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record deposit");
    }
  };

  const addCharge = async () => {
    setError("");
    try {
      await apiClient.post(`/api/ipd/admissions/${admissionId}/charges`,
        chargeType === "visit" ? { type: "visit", doctor_id: Number(chargeDoctor) } : { type: "service", service_id: Number(chargeService), qty: Number(chargeQty) || 1 });
      setChargeDoctor(""); setChargeService(""); setChargeQty(1);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add charge");
    }
  };

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  const admitted = data.admission.status === "admitted";

  return (
    <div className="mt-3 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Charges so far</p>
        {data.items.length === 0 ? <p className="text-xs text-gray-400">Room rent will appear here once the stay has begun.</p> : (
          <ul className="text-sm space-y-1">
            {data.items.map((i, idx) => (
              <li key={idx} className="flex justify-between text-gray-700 dark:text-gray-200">
                <span>{i.description}</span><span>{formatMoney(i.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
          <span>Subtotal</span><span>{formatMoney(data.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500"><span>Deposits</span><span>{formatMoney(data.deposit_total)}</span></div>
        <div className="flex justify-between text-sm font-semibold text-teal-700 dark:text-teal-400"><span>Balance so far</span><span>{formatMoney(data.balance_so_far)}</span></div>
      </div>

      {data.finalized_bill_id ? (
        <button onClick={() => openReceipt(data.finalized_bill_id)} className={smallBtn}>View receipt</button>
      ) : admitted ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Record an advance deposit</p>
            <div className="flex gap-2">
              <input aria-label="Deposit amount" type="number" min={0} className={input} value={depAmount} onChange={(e) => setDepAmount(e.target.value)} />
              <select aria-label="Deposit method" className={`${input} w-24`} value={depMethod} onChange={(e) => setDepMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option>
              </select>
              <button className={smallBtn} onClick={addDeposit} disabled={!Number(depAmount)}>Add</button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Log a charge</p>
            <div className="flex gap-2 mb-2">
              <select aria-label="Charge type" className={input} value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
                <option value="visit">Doctor visit</option><option value="service">Service</option>
              </select>
              {chargeType === "visit" ? (
                <select aria-label="Visiting doctor" className={input} value={chargeDoctor} onChange={(e) => setChargeDoctor(e.target.value)}>
                  <option value="">Select doctor</option>
                  {doctors.filter((d) => d.configured).map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.name} ({formatMoney(d.consultation_fee)})</option>)}
                </select>
              ) : (
                <>
                  <select aria-label="Service" className={input} value={chargeService} onChange={(e) => setChargeService(e.target.value)}>
                    <option value="">Select service</option>
                    {services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({formatMoney(s.price)})</option>)}
                  </select>
                  <input aria-label="Charge quantity" type="number" min={1} className={`${input} w-16`} value={chargeQty} onChange={(e) => setChargeQty(e.target.value)} />
                </>
              )}
            </div>
            <button className={smallBtn} onClick={addCharge} disabled={chargeType === "visit" ? !chargeDoctor : !chargeService}>Add charge</button>
          </div>
        </div>
      ) : (
        <FinalizeBillForm admissionId={admissionId} onDone={(billId) => { onChanged?.(); openReceipt(billId); }} />
      )}
    </div>
  );
};

const FinalizeBillForm = ({ admissionId, onDone }) => {
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const finalize = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await apiClient.post(`/api/ipd/admissions/${admissionId}/bill`, {
        discount: Number(discount) || 0,
        payment: Number(payment) > 0 ? { amount: Number(payment), method } : undefined,
      });
      onDone(data.bill.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to finalize bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4">
      <p className="text-xs font-medium text-teal-800 dark:text-teal-300 mb-2">Patient is discharged — finalize the bill</p>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label htmlFor={`fin-disc-${admissionId}`} className="block text-xs text-gray-500 mb-1">Discount (Rs)</label>
          <input id={`fin-disc-${admissionId}`} type="number" min={0} className={`${input} w-28`} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`fin-pay-${admissionId}`} className="block text-xs text-gray-500 mb-1">Additional payment now (Rs)</label>
          <input id={`fin-pay-${admissionId}`} type="number" min={0} className={`${input} w-28`} value={payment} onChange={(e) => setPayment(e.target.value)} />
        </div>
        <select aria-label="Payment method" className={`${input} w-24`} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option>
        </select>
        <button className={btn} onClick={finalize} disabled={saving}>{saving ? "Finalizing…" : "Finalize bill"}</button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
};

const IpdPage = () => {
  const [board, setBoard] = useState({ beds: [], counts: {} });
  const [admissions, setAdmissions] = useState([]);
  const [pendingBilling, setPendingBilling] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [feeDoctors, setFeeDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [receipt, setReceipt] = useState(null);

  // admit form
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [patient, setPatient] = useState(null);
  const [searchMsg, setSearchMsg] = useState("");
  const [bedId, setBedId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [admitting, setAdmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, a, d] = await Promise.all([
        apiClient.get("/api/ipd/beds"),
        apiClient.get("/api/ipd/admissions?status=admitted"),
        apiClient.get("/api/ipd/admissions?status=discharged"),
      ]);
      setBoard(b.data);
      setAdmissions(a.data.admissions || []);
      setPendingBilling(d.data.admissions || []);
      apiClient.get("/api/ipd/doctors").then((r) => setDoctors(r.data.doctors || [])).catch(() => {});
      apiClient.get("/api/billing/doctors").then((r) => setFeeDoctors(r.data.doctors || [])).catch(() => {});
      apiClient.get("/api/billing/services").then((r) => setServices(r.data.services || [])).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load beds");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Action failed");
    }
  };

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
      setMatches(Array.isArray(data.data) ? data.data : [data.data]);
    } catch (err) {
      setSearchMsg(err.response?.data?.message || "Search failed");
    }
  };

  const admit = async () => {
    setAdmitting(true);
    await act(async () => {
      await apiClient.post("/api/ipd/admissions", {
        patient_id: patient.id, bed_id: Number(bedId),
        doctor_id: doctorId ? Number(doctorId) : undefined, diagnosis: diagnosis || undefined,
      });
      setPatient(null); setQuery(""); setMatches([]); setBedId(""); setDoctorId(""); setDiagnosis("");
    });
    setAdmitting(false);
  };

  const transfer = (adm) => {
    const target = window.prompt(`Move ${adm.patient_name} to which bed? Enter a free bed number, e.g. one shown in green.`);
    if (!target) return;
    const bed = board.beds.find((b) => b.status === "available" && b.bed_no.toLowerCase() === target.trim().toLowerCase());
    if (!bed) return setError("No available bed with that number");
    act(() => apiClient.post(`/api/ipd/admissions/${adm.id}/transfer`, { bed_id: bed.id }));
  };

  const discharge = (adm) => {
    if (!window.confirm(`Discharge ${adm.patient_name}?`)) return;
    const summary = window.prompt("Discharge summary (optional)") || undefined;
    act(() => apiClient.post(`/api/ipd/admissions/${adm.id}/discharge`, { discharge_summary: summary }));
  };

  const openReceipt = async (billId) => {
    const { data } = await apiClient.get(`/api/billing/bills/${billId}`);
    setReceipt(data);
  };
  const collect = async (id, payload) => {
    await apiClient.post(`/api/billing/bills/${id}/payments`, payload);
    await openReceipt(id);
  };

  const toggleExpand = (id) => setExpanded((cur) => (cur === id ? null : id));

  const wards = [...new Set(board.beds.map((b) => b.ward_name))];
  const free = board.beds.filter((b) => b.status === "available");
  const c = board.counts;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Beds & Admissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Live bed board, admit, transfer, discharge and bill patients.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className={`${card} grid grid-cols-5 gap-4`}>
          <Stat label="Total beds" value={c.total ?? 0} tone="text-gray-800 dark:text-gray-100" />
          <Stat label="Available" value={c.available ?? 0} tone="text-emerald-600" />
          <Stat label="Occupied" value={c.occupied ?? 0} tone="text-indigo-600" />
          <Stat label="Cleaning" value={c.cleaning ?? 0} tone="text-amber-600" />
          <Stat label="Maintenance" value={c.maintenance ?? 0} tone="text-gray-500" />
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Bed board</h2>
          {board.beds.length === 0 ? (
            <p className="text-sm text-gray-500">No beds yet — the clinic owner can set up wards and beds under Wards.</p>
          ) : wards.map((w) => (
            <div key={w} className="mb-5">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{w}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {board.beds.filter((b) => b.ward_name === w).map((b) => (
                  <div key={b.id} className={`rounded-xl border p-3 text-xs ${bedStyle[b.status]}`}>
                    <div className="font-semibold text-gray-800 dark:text-gray-100">{b.bed_no}</div>
                    <div className="text-gray-500 dark:text-gray-400 capitalize">{b.status}</div>
                    {b.patient_name && <div className="mt-1 text-gray-700 dark:text-gray-200 truncate">{b.patient_name}</div>}
                    <div className="text-gray-400">{formatMoney(b.daily_rate)}/day</div>
                    {(b.status === "cleaning" || b.status === "maintenance") && (
                      <button onClick={() => act(() => apiClient.put(`/api/ipd/beds/${b.id}/status`, { status: "available" }))}
                        className="mt-1 text-teal-700 hover:underline">Mark available</button>
                    )}
                    {b.status === "available" && (
                      <button onClick={() => act(() => apiClient.put(`/api/ipd/beds/${b.id}/status`, { status: "maintenance" }))}
                        className="mt-1 text-gray-500 hover:underline">Maintenance</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Admit a patient</h2>
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
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span><span className="text-gray-500">Patient:</span> <b className="text-gray-800 dark:text-gray-100">{patient.name}</b></span>
                <button onClick={() => setPatient(null)} className="text-xs text-teal-700 hover:underline">Change</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="adm-bed" className="block text-xs text-gray-500 mb-1">Bed</label>
                  <select id="adm-bed" className={input} value={bedId} onChange={(e) => setBedId(e.target.value)}>
                    <option value="">Select a free bed</option>
                    {free.map((b) => <option key={b.id} value={b.id}>{b.ward_name} — {b.bed_no} ({formatMoney(b.daily_rate)}/day)</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="adm-doc" className="block text-xs text-gray-500 mb-1">Attending doctor</label>
                  <select id="adm-doc" className={input} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                    <option value="">—</option>
                    {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="adm-dx" className="block text-xs text-gray-500 mb-1">Diagnosis</label>
                  <input id="adm-dx" className={input} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                </div>
              </div>
              <button className={btn} onClick={admit} disabled={!bedId || admitting}>{admitting ? "Admitting…" : "Admit"}</button>
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Currently admitted</h2>
          {admissions.length === 0 ? (
            <p className="text-sm text-gray-500">No inpatients right now.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {admissions.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{a.admission_no}</span>
                      <span className="text-gray-500 dark:text-gray-400"> · {a.patient_name} · {a.ward_name} {a.bed_no}</span>
                      <span className="text-gray-400"> · {a.doctor_name ? `Dr. ${a.doctor_name}` : "—"} · since {new Date(a.admitted_at).toLocaleDateString("en-PK")}</span>
                    </div>
                    <div className="whitespace-nowrap">
                      <button onClick={() => toggleExpand(a.id)} className="text-xs text-teal-700 hover:underline mr-3">
                        {expanded === a.id ? "Hide billing" : "Billing"}
                      </button>
                      <button onClick={() => transfer(a)} className="text-xs text-teal-700 hover:underline mr-3">Transfer</button>
                      <button onClick={() => discharge(a)} className="text-xs text-rose-600 hover:underline">Discharge</button>
                    </div>
                  </div>
                  {expanded === a.id && (
                    <RunningBill admissionId={a.id} doctors={feeDoctors} services={services}
                      refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} openReceipt={openReceipt} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Discharged — awaiting bill</h2>
          {pendingBilling.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing pending.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingBilling.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{a.admission_no}</span>
                      <span className="text-gray-500 dark:text-gray-400"> · {a.patient_name}</span>
                      <span className="text-gray-400"> · discharged {new Date(a.discharged_at).toLocaleDateString("en-PK")}</span>
                    </div>
                    <button onClick={() => toggleExpand(a.id)} className="text-xs text-teal-700 hover:underline">
                      {expanded === a.id ? "Hide billing" : "Billing"}
                    </button>
                  </div>
                  {expanded === a.id && (
                    <RunningBill admissionId={a.id} doctors={feeDoctors} services={services}
                      refreshKey={refreshKey} onChanged={() => { setRefreshKey((k) => k + 1); load(); }} openReceipt={openReceipt} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} onPay={collect} />}
    </div>
  );
};

export default IpdPage;
