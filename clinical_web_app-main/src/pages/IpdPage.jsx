import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/axiosClient";
import { formatMoney } from "../utils/billing";

const input =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm";
const card = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6";
const btn = "text-sm font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-lg transition-colors";

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

const IpdPage = () => {
  const [board, setBoard] = useState({ beds: [], counts: {} });
  const [admissions, setAdmissions] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [error, setError] = useState("");

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
      const [b, a] = await Promise.all([apiClient.get("/api/ipd/beds"), apiClient.get("/api/ipd/admissions?status=admitted")]);
      setBoard(b.data);
      setAdmissions(a.data.admissions || []);
      apiClient.get("/api/ipd/doctors").then((d) => setDoctors(d.data.doctors || [])).catch(() => {});
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

  const wards = [...new Set(board.beds.map((b) => b.ward_name))];
  const free = board.beds.filter((b) => b.status === "available");
  const c = board.counts;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Beds & Admissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Live bed board, admit, transfer and discharge patients.</p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-2 pr-3">No</th><th className="pr-3">Patient</th><th className="pr-3">Bed</th>
                    <th className="pr-3">Doctor</th><th className="pr-3">Since</th><th />
                  </tr>
                </thead>
                <tbody>
                  {admissions.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{a.admission_no}</td>
                      <td className="pr-3">{a.patient_name}</td>
                      <td className="pr-3">{a.ward_name} · {a.bed_no}</td>
                      <td className="pr-3">{a.doctor_name ? `Dr. ${a.doctor_name}` : "—"}</td>
                      <td className="pr-3">{new Date(a.admitted_at).toLocaleDateString("en-PK")}</td>
                      <td className="whitespace-nowrap">
                        <button onClick={() => transfer(a)} className="text-xs text-teal-700 hover:underline mr-3">Transfer</button>
                        <button onClick={() => discharge(a)} className="text-xs text-rose-600 hover:underline">Discharge</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IpdPage;
