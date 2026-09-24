import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaBuilding, FaHospital, FaUserDoctor, FaUsers, FaClock, FaEnvelope, FaKey,
  FaUser, FaPenToSquare, FaBan, FaCircleCheck, FaCopy, FaPlus, FaShieldHalved,
  FaHourglassHalf, FaXmark,
} from "react-icons/fa6";
import apiClient from "../utils/axiosClient";
import { getUser, logout } from "../utils/auth";

// Mirrors src/config/plans.js on the backend — used here only to prefill the
// create-clinic form's seat-count fields when a plan is picked. The backend
// independently applies its own preset on create/update regardless of what
// gets submitted, so this ever drifting out of sync is a UX nit, not a bug.
const PLAN_PRESETS = {
  clinic: { max_doctors: 1, max_receptionists: 1 },
  hospital: { max_doctors: 10, max_receptionists: 5 },
};
const PLAN_LABELS = { clinic: "Clinic", hospital: "Hospital" };

const PLAN_CARDS = [
  {
    key: "clinic", icon: FaUserDoctor, title: "Clinic",
    blurb: "Small practice — one or two doctors.",
    seats: `${PLAN_PRESETS.clinic.max_doctors} doctor · ${PLAN_PRESETS.clinic.max_receptionists} receptionist`,
  },
  {
    key: "hospital", icon: FaHospital, title: "Hospital",
    blurb: "Bigger setup — every module turned on.",
    seats: `${PLAN_PRESETS.hospital.max_doctors} doctors · ${PLAN_PRESETS.hospital.max_receptionists} receptionists`,
  },
];

const FEATURES = [
  { key: "ai_suggestions", label: "AI diagnosis suggestions" },
  { key: "chatbot", label: "Medical chatbot" },
  { key: "whatsapp_reminders", label: "WhatsApp follow-up reminders" },
  { key: "billing", label: "Fees, billing & receipts" },
  { key: "ipd", label: "Wards, beds & admissions" },
];

const emptyForm = {
  name: "",
  slug: "",
  plan: "clinic",
  max_doctors: PLAN_PRESETS.clinic.max_doctors,
  max_receptionists: PLAN_PRESETS.clinic.max_receptionists,
  isTrial: false,
  trialDays: 7,
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const input =
  "w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow";
const label = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

const FieldIcon = ({ icon: Icon }) => (
  <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
);

const SectionHeading = ({ icon: Icon, title, hint }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  </div>
);

const PlanBadge = ({ plan }) => (
  <span
    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
      plan === "hospital"
        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
        : "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
    }`}
  >
    {PLAN_LABELS[plan] || plan || "Clinic"}
  </span>
);

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
      status === "active"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
    }`}
  >
    {status}
  </span>
);

// Purely cosmetic for the operator's own view — the customer's actual access
// is gated server-side against Postgres's own clock (requireTrialActive),
// never by this component's Date.now().
const trialState = (clinic) => {
  if (!clinic.is_trial) return null;
  if (!clinic.trial_started_at) return { label: "Not started", tone: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
  const daysLeft = Math.ceil((new Date(clinic.trial_ends_at) - new Date()) / 86400000);
  if (daysLeft <= 0) return { label: "Expired", tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" };
  return { label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
};

const TrialBadge = ({ clinic }) => {
  const t = trialState(clinic);
  if (!t) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${t.tone}`}>{t.label}</span>;
};

// A checkbox with a proper toggle-switch look — same semantics, just skinned.
const Switch = ({ id, checked, onChange }) => (
  <label htmlFor={id} className="relative inline-flex items-center cursor-pointer shrink-0">
    <input id={id} type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
    <div className="w-10 h-[22px] bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-amber-500 transition-colors" />
    <div className="absolute left-[3px] top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]" />
  </label>
);

const SeatBar = ({ used, max }) => {
  const pct = max > 0 ? Math.min(100, (Number(used) / Number(max)) * 100) : 0;
  return (
    <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-amber-500" : "bg-teal-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

const PlatformAdminPage = ({ onLogout }) => {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied, setCopied] = useState(false);

  // Inline "Edit" row — at most one clinic edited at a time.
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [extendDays, setExtendDays] = useState(7);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiClient.get("/api/platform/clinics");
      setClinics(data.clinics || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load clinics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const stats = useMemo(() => ({
    total: clinics.length,
    active: clinics.filter((c) => c.status === "active").length,
    trial: clinics.filter((c) => c.is_trial && trialState(c)?.label !== "Expired").length,
    suspended: clinics.filter((c) => c.status !== "active").length,
  }), [clinics]);

  const handleFormChange = (field) => (e) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: f._slugTouched ? f.slug : slugify(name) }));
  };

  const handlePlanChange = (plan) => {
    const preset = PLAN_PRESETS[plan] || PLAN_PRESETS.clinic;
    setForm((f) => ({ ...f, plan, max_doctors: preset.max_doctors, max_receptionists: preset.max_receptionists }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreatedCreds(null);
    setCreating(true);
    try {
      const { data } = await apiClient.post("/api/platform/clinics", {
        name: form.name,
        slug: form.slug,
        plan: form.plan,
        max_doctors: Number(form.max_doctors) || 1,
        max_receptionists: Number(form.max_receptionists) || 0,
        is_trial: form.isTrial,
        ...(form.isTrial && { trial_days: Number(form.trialDays) || 7 }),
        owner: {
          name: form.ownerName,
          email: form.ownerEmail,
          password: form.ownerPassword,
        },
      });
      setCreatedCreds({ email: data.owner.email, password: form.ownerPassword, clinic: data.clinic.name });
      setForm(emptyForm);
      await loadClinics();
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create clinic");
    } finally {
      setCreating(false);
    }
  };

  const copyCreds = async () => {
    if (!createdCreds) return;
    try {
      await navigator.clipboard.writeText(`${createdCreds.email} / ${createdCreds.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — the credentials are still visible to copy by hand
    }
  };

  const toggleStatus = async (clinic) => {
    const nextStatus = clinic.status === "active" ? "suspended" : "active";
    try {
      await apiClient.patch(`/api/platform/clinics/${clinic.id}`, { status: nextStatus });
      await loadClinics();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update clinic");
    }
  };

  const startEdit = (clinic) => {
    setEditError("");
    setEditingId(clinic.id);
    setEditForm({
      plan: clinic.plan || "clinic",
      max_doctors: clinic.max_doctors,
      max_receptionists: clinic.max_receptionists,
      features: { ...(clinic.features || {}) },
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditError("");
  };

  const saveEdit = async (clinicId) => {
    setEditSaving(true);
    setEditError("");
    try {
      await apiClient.patch(`/api/platform/clinics/${clinicId}`, {
        plan: editForm.plan,
        max_doctors: Number(editForm.max_doctors) || 1,
        max_receptionists: Number(editForm.max_receptionists) || 0,
        features: editForm.features,
      });
      await loadClinics();
      cancelEdit();
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to update clinic");
    } finally {
      setEditSaving(false);
    }
  };

  const extendTrial = async (clinicId) => {
    setEditError("");
    try {
      await apiClient.patch(`/api/platform/clinics/${clinicId}`, { extend_trial_days: Number(extendDays) || 7 });
      await loadClinics();
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to extend trial");
    }
  };

  const convertToPaid = async (clinicId) => {
    if (!window.confirm("Convert this trial to a regular paid clinic? Access won't expire anymore.")) return;
    setEditError("");
    try {
      await apiClient.patch(`/api/platform/clinics/${clinicId}`, { is_trial: false });
      await loadClinics();
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to convert clinic");
    }
  };

  const handleLogout = async () => {
    await logout();
    onLogout?.();
  };

  const user = getUser();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <FaShieldHalved className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Platform Admin</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Signed in as {user?.name || user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 border border-gray-200 dark:border-gray-600 hover:border-rose-300 dark:hover:border-rose-500 px-4 py-2 rounded-xl transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Clinics", value: stats.total, icon: FaBuilding, tone: "text-gray-700 dark:text-gray-200", bg: "bg-gray-100 dark:bg-gray-700" },
            { label: "Active", value: stats.active, icon: FaCircleCheck, tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
            { label: "On trial", value: stats.trial, icon: FaHourglassHalf, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
            { label: "Suspended", value: stats.suspended, icon: FaBan, tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/30" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} ${s.tone} flex items-center justify-center shrink-0`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Create clinic */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <FaPlus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Create a clinic</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-7">
            {/* Clinic details */}
            <div>
              <SectionHeading icon={FaBuilding} title="Clinic details" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="clinic-name" className={label}>Clinic name</label>
                  <div className="relative">
                    <FieldIcon icon={FaBuilding} />
                    <input
                      id="clinic-name"
                      required
                      value={form.name}
                      onChange={handleNameChange}
                      className={input}
                      placeholder="Green Valley Clinic"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="clinic-slug" className={label}>Slug</label>
                  <div className="relative">
                    <FieldIcon icon={FaKey} />
                    <input
                      id="clinic-slug"
                      required
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value), _slugTouched: true }))}
                      className={input}
                      placeholder="green-valley-clinic"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Plan */}
            <div>
              <SectionHeading icon={FaHospital} title="Plan" hint="Sets starting seats + features — everything stays editable per clinic afterward." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {PLAN_CARDS.map((p) => {
                  const selected = form.plan === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handlePlanChange(p.key)}
                      className={`text-left rounded-xl border-2 p-4 transition-all ${
                        selected
                          ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
                          <p.icon className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-gray-100">{p.title}</span>
                        {selected && <FaCircleCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.blurb}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{p.seats}</p>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="max-doctors" className={label}>Max doctors</label>
                  <div className="relative">
                    <FieldIcon icon={FaUserDoctor} />
                    <input
                      id="max-doctors"
                      type="number"
                      min={1}
                      required
                      value={form.max_doctors}
                      onChange={handleFormChange("max_doctors")}
                      className={input}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="max-receptionists" className={label}>Max receptionists</label>
                  <div className="relative">
                    <FieldIcon icon={FaUsers} />
                    <input
                      id="max-receptionists"
                      type="number"
                      min={0}
                      required
                      value={form.max_receptionists}
                      onChange={handleFormChange("max_receptionists")}
                      className={input}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Trial */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/60 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <FaClock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Demo / trial account</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Expires N days after the owner's first login — enforced by the server's clock, not the customer's device.</p>
                </div>
                <Switch id="clinic-trial" checked={form.isTrial} onChange={(e) => setForm((f) => ({ ...f, isTrial: e.target.checked }))} />
              </div>
              {form.isTrial && (
                <div className="flex items-center gap-2 mt-3 pl-11">
                  <label htmlFor="trial-days" className="text-sm text-amber-800 dark:text-amber-300">Trial length:</label>
                  <input
                    id="trial-days"
                    type="number"
                    min={1}
                    value={form.trialDays}
                    onChange={handleFormChange("trialDays")}
                    className="w-16 px-2 py-1.5 border border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-center"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-400">days</span>
                </div>
              )}
            </div>

            {/* Owner */}
            <div>
              <SectionHeading icon={FaUser} title="Clinic owner" hint="The first doctor account — they log in and invite the rest of the staff." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="owner-name" className={label}>Owner name</label>
                  <div className="relative">
                    <FieldIcon icon={FaUser} />
                    <input
                      id="owner-name"
                      required
                      value={form.ownerName}
                      onChange={handleFormChange("ownerName")}
                      className={input}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="owner-email" className={label}>Owner email</label>
                  <div className="relative">
                    <FieldIcon icon={FaEnvelope} />
                    <input
                      id="owner-email"
                      type="email"
                      required
                      value={form.ownerEmail}
                      onChange={handleFormChange("ownerEmail")}
                      className={input}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="owner-password" className={label}>Owner password</label>
                  <div className="relative">
                    <FieldIcon icon={FaKey} />
                    <input
                      id="owner-password"
                      type="text"
                      required
                      minLength={8}
                      value={form.ownerPassword}
                      onChange={handleFormChange("ownerPassword")}
                      className={input}
                      placeholder="Set a starting password — share it with the owner"
                    />
                  </div>
                </div>
              </div>
            </div>

            {createError && <p className="text-sm text-rose-600 dark:text-rose-400">{createError}</p>}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 px-5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-all text-sm shadow-sm shadow-teal-600/20 flex items-center justify-center gap-2"
            >
              {creating ? "Creating…" : (
                <>
                  <FaPlus className="w-3.5 h-3.5" />
                  Create clinic
                </>
              )}
            </button>
          </form>

          {createdCreds && (
            <div className="mt-5 p-4 rounded-xl bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-sm text-teal-800 dark:text-teal-200">
              <div className="flex items-start justify-between gap-3">
                <p><strong>{createdCreds.clinic}</strong> created. Share these credentials with the owner:</p>
                <button onClick={copyCreds} title="Copy" className="shrink-0 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200">
                  <FaCopy className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-1.5 font-mono text-xs bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2">
                {createdCreds.email} / {createdCreds.password}
              </div>
              {copied && <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">Copied.</p>}
            </div>
          )}
        </div>

        {/* Clinic list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FaBuilding className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Clinics</h2>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : clinics.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No clinics yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pl-6 pr-4 font-medium">Clinic</th>
                    <th className="py-2 pr-4 font-medium">Plan</th>
                    <th className="py-2 pr-4 font-medium">Trial</th>
                    <th className="py-2 pr-4 font-medium">Doctors</th>
                    <th className="py-2 pr-4 font-medium">Receptionists</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c) => (
                    <React.Fragment key={c.id}>
                      <tr className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/20 transition-colors">
                        <td className="py-3 pl-6 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {(c.name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{c.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{c.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4"><PlanBadge plan={c.plan} /></td>
                        <td className="py-3 pr-4"><TrialBadge clinic={c} /></td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">{c.doctor_count} / {c.max_doctors}</span>
                            <SeatBar used={c.doctor_count} max={c.max_doctors} />
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">{c.receptionist_count} / {c.max_receptionists}</span>
                            <SeatBar used={c.receptionist_count} max={c.max_receptionists} />
                          </div>
                        </td>
                        <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                        <td className="py-3 pr-6 whitespace-nowrap">
                          <button
                            onClick={() => (editingId === c.id ? cancelEdit() : startEdit(c))}
                            title="Edit"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-teal-700 dark:hover:text-teal-400 border border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 px-2.5 py-1.5 rounded-lg mr-2 transition-colors"
                          >
                            {editingId === c.id ? <FaXmark className="w-3 h-3" /> : <FaPenToSquare className="w-3 h-3" />}
                            {editingId === c.id ? "Close" : "Edit"}
                          </button>
                          <button
                            onClick={() => toggleStatus(c)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-teal-700 dark:hover:text-teal-400 border border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            {c.status === "active" ? <FaBan className="w-3 h-3" /> : <FaCircleCheck className="w-3 h-3" />}
                            {c.status === "active" ? "Suspend" : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                      {editingId === c.id && editForm && (
                        <tr className="border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-700/20">
                          <td colSpan={7} className="py-5 px-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label htmlFor={`edit-plan-${c.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plan</label>
                                <select
                                  id={`edit-plan-${c.id}`}
                                  value={editForm.plan}
                                  onChange={(e) => {
                                    const plan = e.target.value;
                                    setEditForm((f) => ({ ...f, plan }));
                                  }}
                                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                >
                                  <option value="clinic">Clinic</option>
                                  <option value="hospital">Hospital</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`edit-max-doctors-${c.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max doctors</label>
                                <input
                                  id={`edit-max-doctors-${c.id}`}
                                  type="number"
                                  min={1}
                                  value={editForm.max_doctors}
                                  onChange={(e) => setEditForm((f) => ({ ...f, max_doctors: Number(e.target.value) }))}
                                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                />
                              </div>
                              <div>
                                <label htmlFor={`edit-max-receptionists-${c.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max receptionists</label>
                                <input
                                  id={`edit-max-receptionists-${c.id}`}
                                  type="number"
                                  min={0}
                                  value={editForm.max_receptionists}
                                  onChange={(e) => setEditForm((f) => ({ ...f, max_receptionists: Number(e.target.value) }))}
                                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Features</p>
                              <div className="flex flex-wrap gap-2">
                                {FEATURES.map(({ key, label: featLabel }) => {
                                  const on = Boolean(editForm.features[key]);
                                  return (
                                    <label
                                      key={key}
                                      htmlFor={`edit-feature-${key}-${c.id}`}
                                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                                        on
                                          ? "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300"
                                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                                      }`}
                                    >
                                      <input
                                        id={`edit-feature-${key}-${c.id}`}
                                        type="checkbox"
                                        checked={on}
                                        onChange={(e) =>
                                          setEditForm((f) => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))
                                        }
                                        className="sr-only"
                                      />
                                      {on && <FaCircleCheck className="w-3 h-3" />}
                                      {featLabel}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {c.is_trial && (
                              <div className="mt-4 flex flex-wrap items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-3">
                                <TrialBadge clinic={c} />
                                <span className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                                  Extend by
                                  <input
                                    aria-label={`Extend trial days for ${c.name}`}
                                    type="number"
                                    min={1}
                                    value={extendDays}
                                    onChange={(e) => setExtendDays(e.target.value)}
                                    className="w-16 px-2 py-1 border border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-center"
                                  />
                                  days
                                </span>
                                <button
                                  onClick={() => extendTrial(c.id)}
                                  className="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Extend
                                </button>
                                <button
                                  onClick={() => convertToPaid(c.id)}
                                  className="text-xs font-medium border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Convert to paid
                                </button>
                              </div>
                            )}

                            {editError && <p className="text-sm text-rose-600 dark:text-rose-400 mt-3">{editError}</p>}

                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => saveEdit(c.id)}
                                disabled={editSaving}
                                className="py-2 px-5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium rounded-lg text-xs transition-colors"
                              >
                                {editSaving ? "Saving…" : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="py-2 px-5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

export default PlatformAdminPage;
