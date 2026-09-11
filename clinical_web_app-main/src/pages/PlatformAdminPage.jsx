import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/axiosClient";
import { getUser, logout } from "../utils/auth";

const emptyForm = {
  name: "",
  slug: "",
  max_doctors: 1,
  max_receptionists: 0,
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const PlatformAdminPage = ({ onLogout }) => {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreatedCreds(null);
    setCreating(true);
    try {
      const { data } = await apiClient.post("/api/platform/clinics", {
        name: form.name,
        slug: form.slug,
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
                    <th className="py-2 pr-4">Doctors</th>
                    <th className="py-2 pr-4">Receptionists</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-100">{c.name}</td>
                      <td className="py-2 pr-4 text-gray-500">{c.slug}</td>
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
                      <td className="py-2">
                        <button
                          onClick={() => toggleStatus(c)}
                          className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-teal-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg"
                        >
                          {c.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
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

export default PlatformAdminPage;
