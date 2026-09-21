import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/axiosClient";
import { formatMoney } from "../utils/billing";

const input =
  "w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm";
const card = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6";
const btn = "text-xs font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-3 py-1.5 rounded-lg";
const TYPES = ["general", "semi_private", "private", "icu", "ccu", "nicu", "other"];

const WardRow = ({ ward, onChanged, onError }) => {
  const [count, setCount] = useState(1);
  const [prefix, setPrefix] = useState("");

  const addBeds = async () => {
    try {
      await apiClient.post(`/api/ipd/wards/${ward.id}/beds`, { count: Number(count), prefix });
      onChanged();
    } catch (err) {
      onError(err.response?.data?.message || "Failed to add beds");
    }
  };
  const toggle = async () => {
    try {
      await apiClient.put(`/api/ipd/wards/${ward.id}`, { ...ward, active: !ward.active });
      onChanged();
    } catch (err) {
      onError(err.response?.data?.message || "Failed to update ward");
    }
  };

  return (
    <li className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className={ward.active ? "" : "opacity-50"}>
        <span className="font-medium text-gray-800 dark:text-gray-100">{ward.name}</span>
        <span className="text-xs text-gray-400"> · {ward.ward_type.replace("_", " ")} · {formatMoney(ward.daily_rate)}/bed/day · {ward.bed_count} beds</span>
      </div>
      <div className="flex items-center gap-2">
        <input aria-label={`Prefix for ${ward.name}`} className={`${input} w-20`} placeholder="Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        <input aria-label={`Bed count for ${ward.name}`} type="number" min={1} max={100} className={`${input} w-16`} value={count} onChange={(e) => setCount(e.target.value)} />
        <button onClick={addBeds} className={btn}>Add beds</button>
        <button onClick={toggle} className="text-xs text-gray-500 hover:text-teal-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg">
          {ward.active ? "Disable" : "Enable"}
        </button>
      </div>
    </li>
  );
};

const WardSetupPage = () => {
  const [wards, setWards] = useState([]);
  const [form, setForm] = useState({ name: "", ward_type: "general", daily_rate: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/api/ipd/wards");
      setWards(data.wards || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load wards");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiClient.post("/api/ipd/wards", { ...form, daily_rate: Number(form.daily_rate) });
      setForm({ name: "", ward_type: "general", daily_rate: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create ward");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wards & Beds</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create wards with a daily bed rate, then add beds — e.g. a 10-bed hospital is one or two wards totalling 10 beds.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">New ward</h2>
          <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="ward-name" className="block text-xs text-gray-500 mb-1">Ward name</label>
              <input id="ward-name" required className={input} value={form.name} placeholder="General, ICU, Private rooms…"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ward-type" className="block text-xs text-gray-500 mb-1">Type</label>
              <select id="ward-type" className={input} value={form.ward_type} onChange={(e) => setForm({ ...form, ward_type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ward-rate" className="block text-xs text-gray-500 mb-1">Rate / bed / day (Rs)</label>
              <div className="flex gap-2">
                <input id="ward-rate" required type="number" min={0} className={input} value={form.daily_rate}
                  onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} />
                <button className={btn} type="submit">Create</button>
              </div>
            </div>
          </form>
        </div>
        <div className={card}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Wards</h2>
          {wards.length === 0 ? <p className="text-sm text-gray-500">No wards yet.</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {wards.map((w) => <WardRow key={w.id} ward={w} onChanged={load} onError={setError} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default WardSetupPage;
