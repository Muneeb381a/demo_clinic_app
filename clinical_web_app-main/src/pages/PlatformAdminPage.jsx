import React, { useCallback, useEffect, useState } from "react";
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

const FEATURES = [
  { key: "ai_suggestions", label: "AI diagnosis suggestions" },
  { key: "chatbot", label: "Medical chatbot" },
  { key: "whatsapp_reminders", label: "WhatsApp follow-up reminders" },
];

const emptyForm = {
  name: "",
  slug: "",
  plan: "clinic",
  max_doctors: PLAN_PRESETS.clinic.max_doctors,
  max_receptionists: PLAN_PRESETS.clinic.max_receptionists,
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const PlanBadge = ({ plan }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      plan === "hospital"
        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
        : "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
    }`}
  >
    {PLAN_LABELS[plan] || plan || "Clinic"}
  </span>
);

const PlatformAdminPage = ({ onLogout }) => {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);

  // Inline "Edit" row — at most one clinic edited at a time.
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

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

  const handleFormChange = (field) => (e) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: f._slugTouched ? f.slug : slugify(name) }));
  };

  const handlePlanChange = (e) => {
    const plan = e.target.value;
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

  const handleLogout = async () => {
    await logout();
    onLogout?.();
  };

  const user = getUser();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-teal-700 dark:text-teal-400">Platform Admin</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Signed in as {user?.name || user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 border border-gray-200 dark:border-gray-600 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Create clinic */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Create a clinic</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="clinic-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic name</label>
              <input
                id="clinic-name"
                required
                value={form.name}
                onChange={handleNameChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="Green Valley Clinic"
              />
            </div>
            <div>
              <label htmlFor="clinic-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <input
                id="clinic-slug"
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value), _slugTouched: true }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="green-valley-clinic"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="clinic-plan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
              <select
                id="clinic-plan"
                value={form.plan}
                onChange={handlePlanChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                <option value="clinic">Clinic — small practice (1 doctor, 1 receptionist)</option>
                <option value="hospital">Hospital — bigger setup, every feature on (10 doctors, 5 receptionists)</option>
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Sets starting seats + features below — both stay editable per clinic afterward (see the "Edit" action in the list).
              </p>
            </div>
            <div>
              <label htmlFor="max-doctors" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max doctors</label>
              <input
                id="max-doctors"
                type="number"
                min={1}
                required
                value={form.max_doctors}
                onChange={handleFormChange("max_doctors")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label htmlFor="max-receptionists" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max receptionists</label>
              <input
                id="max-receptionists"
                type="number"
                min={0}
                required
                value={form.max_receptionists}
                onChange={handleFormChange("max_receptionists")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
            </div>

            <div className="sm:col-span-2 border-t border-gray-100 dark:border-gray-700 pt-4 mt-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Clinic owner (first doctor)</p>
            </div>
            <div>
              <label htmlFor="owner-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner name</label>
              <input
                id="owner-name"
                required
                value={form.ownerName}
                onChange={handleFormChange("ownerName")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label htmlFor="owner-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner email</label>
              <input
                id="owner-email"
                type="email"
                required
                value={form.ownerEmail}
                onChange={handleFormChange("ownerEmail")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="owner-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner password</label>
              <input
                id="owner-password"
                type="text"
                required
                minLength={8}
                value={form.ownerPassword}
                onChange={handleFormChange("ownerPassword")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="Set a starting password — share it with the owner"
              />
            </div>

            {createError && <p className="sm:col-span-2 text-sm text-red-600">{createError}</p>}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="py-2 px-5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium rounded-lg transition-colors text-sm"
              >
                {creating ? "Creating…" : "Create clinic"}
              </button>
            </div>
          </form>

          {createdCreds && (
            <div className="mt-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-sm text-teal-800 dark:text-teal-200">
              <strong>{createdCreds.clinic}</strong> created. Share these credentials with the owner:
              <div className="mt-1 font-mono text-xs">
                {createdCreds.email} / {createdCreds.password}
              </div>
            </div>
          )}
        </div>

        {/* Clinic list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Clinics</h2>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : clinics.length === 0 ? (
            <p className="text-sm text-gray-500">No clinics yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-2 pr-4">Clinic</th>
                    <th className="py-2 pr-4">Slug</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Doctors</th>
                    <th className="py-2 pr-4">Receptionists</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c) => (
                    <React.Fragment key={c.id}>
                      <tr className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-100">{c.name}</td>
                        <td className="py-2 pr-4 text-gray-500">{c.slug}</td>
                        <td className="py-2 pr-4"><PlanBadge plan={c.plan} /></td>
                        <td className="py-2 pr-4">{c.doctor_count} / {c.max_doctors}</td>
                        <td className="py-2 pr-4">{c.receptionist_count} / {c.max_receptionists}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              c.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <button
                            onClick={() => (editingId === c.id ? cancelEdit() : startEdit(c))}
                            className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-teal-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg mr-2"
                          >
                            {editingId === c.id ? "Close" : "Edit"}
                          </button>
                          <button
                            onClick={() => toggleStatus(c)}
                            className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-teal-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg"
                          >
                            {c.status === "active" ? "Suspend" : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                      {editingId === c.id && editForm && (
                        <tr className="border-b border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-700/30">
                          <td colSpan={7} className="py-4 px-4">
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
                                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
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
                                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
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
                                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Features</p>
                              <div className="flex flex-wrap gap-4">
                                {FEATURES.map(({ key, label }) => (
                                  <label key={key} htmlFor={`edit-feature-${key}-${c.id}`} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <input
                                      id={`edit-feature-${key}-${c.id}`}
                                      type="checkbox"
                                      checked={Boolean(editForm.features[key])}
                                      onChange={(e) =>
                                        setEditForm((f) => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))
                                      }
                                      className="rounded border-gray-300"
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {editError && <p className="text-sm text-red-600 mt-3">{editError}</p>}

                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => saveEdit(c.id)}
                                disabled={editSaving}
                                className="py-1.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium rounded-lg text-xs"
                              >
                                {editSaving ? "Saving…" : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="py-1.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-xs"
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
