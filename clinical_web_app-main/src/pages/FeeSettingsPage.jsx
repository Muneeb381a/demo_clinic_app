import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/axiosClient";
import { formatMoney } from "../utils/billing";

const input =
  "w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm";
const card = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6";
const CATEGORIES = ["procedure", "lab", "radiology", "other"];

const DoctorRow = ({ doc, onSaved }) => {
  const [f, setF] = useState({
    doctor_type: doc.doctor_type,
    consultation_fee: doc.consultation_fee,
    followup_fee: doc.followup_fee,
    hospital_share_pct: Number(doc.hospital_share_pct),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const visiting = f.doctor_type === "visiting";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`/api/billing/doctors/${doc.doctor_id}`, {
        doctor_type: f.doctor_type,
        consultation_fee: Number(f.consultation_fee),
        followup_fee: Number(f.followup_fee),
        hospital_share_pct: visiting ? Number(f.hospital_share_pct) : 0,
        doctor_share_pct: visiting ? 100 - Number(f.hospital_share_pct) : 100,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-gray-50 dark:border-gray-700/50 align-top">
      <td className="py-3 pr-3">
        <div className="font-medium text-gray-800 dark:text-gray-100">Dr. {doc.name}</div>
        <div className="text-xs text-gray-400">{doc.configured ? "Fee set" : "No fee set yet"}</div>
      </td>
      <td className="py-3 pr-3 w-32">
        <select aria-label={`Type for ${doc.name}`} className={input} value={f.doctor_type}
          onChange={(e) => setF({ ...f, doctor_type: e.target.value })}>
          <option value="staff">Staff</option>
          <option value="visiting">Visiting</option>
        </select>
      </td>
      <td className="py-3 pr-3 w-32">
        <input aria-label={`Consultation fee for ${doc.name}`} type="number" min={0} className={input}
          value={f.consultation_fee} onChange={(e) => setF({ ...f, consultation_fee: e.target.value })} />
      </td>
      <td className="py-3 pr-3 w-32">
        <input aria-label={`Follow-up fee for ${doc.name}`} type="number" min={0} className={input}
          value={f.followup_fee} onChange={(e) => setF({ ...f, followup_fee: e.target.value })} />
      </td>
      <td className="py-3 pr-3 w-44">
        {visiting ? (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <input aria-label={`Hospital share % for ${doc.name}`} type="number" min={0} max={100} className={`${input} w-16`}
              value={f.hospital_share_pct}
              onChange={(e) => setF({ ...f, hospital_share_pct: Math.min(100, Math.max(0, Number(e.target.value))) })} />
            % hospital · {100 - f.hospital_share_pct}% doctor
          </div>
        ) : (
          <span className="text-xs text-gray-400">Doctor keeps 100%</span>
        )}
      </td>
      <td className="py-3">
        <button onClick={save} disabled={saving}
          className="text-xs font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-3 py-1.5 rounded-lg">
          {saving ? "Saving…" : "Save"}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
    </tr>
  );
};

const FeeSettingsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");
  const [svc, setSvc] = useState({ name: "", category: "procedure", price: "" });
  const [svcError, setSvcError] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([apiClient.get("/api/billing/doctors"), apiClient.get("/api/billing/services")]);
      setDoctors(d.data.doctors || []);
      setServices(s.data.services || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load fee settings");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addService = async (e) => {
    e.preventDefault();
    setSvcError("");
    try {
      await apiClient.post("/api/billing/services", { ...svc, price: Number(svc.price) });
      setSvc({ name: "", category: "procedure", price: "" });
      load();
    } catch (err) {
      setSvcError(err.response?.data?.message || "Failed to add service");
    }
  };

  const updateService = async (s, patch) => {
    try {
      await apiClient.put(`/api/billing/services/${s.id}`, { name: s.name, category: s.category, price: s.price, active: s.active, ...patch });
      load();
    } catch (err) {
      setSvcError(err.response?.data?.message || "Failed to update service");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fees & Services</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Set each doctor's consultation fee and, for visiting doctors, how each fee is shared with the hospital.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Doctor fees</h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-gray-500">No doctors in this clinic yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-2 pr-3">Doctor</th><th className="pr-3">Type</th>
                    <th className="pr-3">Consultation</th><th className="pr-3">Follow-up</th>
                    <th className="pr-3">Share</th><th />
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d) => <DoctorRow key={`${d.doctor_id}-${d.configured}`} doc={d} onSaved={load} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Services & procedures</h2>
          <form onSubmit={addService} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <div className="sm:col-span-2">
              <label htmlFor="svc-name" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Service name</label>
              <input id="svc-name" required className={input} value={svc.name} placeholder="ECG, X-Ray, Dressing…"
                onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="svc-cat" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
              <select id="svc-cat" className={input} value={svc.category} onChange={(e) => setSvc({ ...svc, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="svc-price" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Price (Rs)</label>
              <div className="flex gap-2">
                <input id="svc-price" required type="number" min={0} className={input} value={svc.price}
                  onChange={(e) => setSvc({ ...svc, price: e.target.value })} />
                <button type="submit" className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white px-3 rounded-lg">Add</button>
              </div>
            </div>
          </form>
          {svcError && <p className="text-sm text-red-600 mb-3">{svcError}</p>}
          {services.length === 0 ? (
            <p className="text-sm text-gray-500">No services yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {services.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className={s.active ? "text-gray-800 dark:text-gray-100" : "text-gray-400 line-through"}>
                    {s.name} <span className="text-xs text-gray-400">· {s.category}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{formatMoney(s.price)}</span>
                    <button onClick={() => updateService(s, { active: !s.active })}
                      className="text-xs text-gray-500 hover:text-teal-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg">
                      {s.active ? "Disable" : "Enable"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeeSettingsPage;
