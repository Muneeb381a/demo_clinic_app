import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/axiosClient";
import { getUser } from "../utils/auth";

const ClinicStaffPage = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("receptionist");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteLink, setInviteLink] = useState(null);

  const me = getUser();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiClient.get("/api/clinic/staff");
      setStaff(data.staff || []);
      setPendingInvites(data.pendingInvites || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError("");
    setInviteLink(null);
    setInviting(true);
    try {
      const { data } = await apiClient.post("/api/clinic/invites", { email, role });
      setInviteLink(`${window.location.origin}/join/${data.invite.token}`);
      setEmail("");
      await load();
    } catch (err) {
      setInviteError(err.response?.data?.message || "Failed to create invite");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (id) => {
    try {
      await apiClient.delete(`/api/clinic/invites/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel invite");
    }
  };

  const handleRemoveStaff = async (id) => {
    try {
      await apiClient.delete(`/api/clinic/staff/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove staff member");
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard access denied — the link is still visible to copy by hand
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-teal-700 dark:text-teal-400">Clinic Staff</h1>
          <button
            onClick={() => navigate(-1)}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-teal-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg"
          >
            Back
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Invite a staff member</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="py-2 px-5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {inviting ? "Sending…" : "Create invite"}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
          {inviteLink && (
            <div className="mt-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-sm text-teal-800 dark:text-teal-200">
              Invite created. Share this link — it works once, for 7 days:
              <div className="mt-1 flex items-center gap-2">
                <code className="text-xs break-all">{inviteLink}</code>
                <button
                  onClick={() => copyLink(inviteLink)}
                  className="text-xs font-medium underline shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {pendingInvites.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Pending invites</h2>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span>
                    {inv.email} <span className="text-gray-400">({inv.role})</span>
                  </span>
                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Staff</h2>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {staff.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-800 dark:text-gray-100">
                    {s.name} <span className="text-gray-400">— {s.email}</span>{" "}
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {s.role}{s.is_owner ? " · owner" : ""}
                    </span>
                  </span>
                  {!s.is_owner && s.id !== me?.id && (
                    <button
                      onClick={() => handleRemoveStaff(s.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicStaffPage;
