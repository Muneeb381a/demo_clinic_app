import React, { useEffect, useState } from "react";
import apiClient from "../utils/axiosClient";
import { setSession } from "../utils/auth";

const AcceptInvitePage = ({ token, onAccepted }) => {
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(`/api/auth/invite/${token}`)
      .then(({ data }) => { if (!cancelled) setPreview(data.invite); })
      .catch((err) => {
        if (!cancelled) setPreviewError(err.response?.data?.message || "This invite link is invalid or has expired");
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const { data } = await apiClient.post("/api/auth/accept-invite", { token, name, password });
      setSession(data);
      onAccepted?.();
    } catch (err) {
      setSubmitError(err.response?.data?.message || "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-teal-700 dark:text-teal-400 mb-1">
          Join {preview?.clinicName || "your clinic"}
        </h1>

        {previewError ? (
          <p className="text-center text-sm text-red-600 mt-4">{previewError}</p>
        ) : !preview ? (
          <p className="text-center text-sm text-gray-500 mt-4">Checking your invite…</p>
        ) : (
          <>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
              You've been invited as a {preview.role} ({preview.email}). Set a name and password to finish.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="invite-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your name</label>
                <input
                  id="invite-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
              <div>
                <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Choose a password</label>
                <input
                  id="invite-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  placeholder="At least 8 characters"
                />
              </div>

              {submitError && <p className="text-sm text-red-600 text-center">{submitError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium rounded-lg transition-colors text-sm"
              >
                {submitting ? "Joining…" : "Join clinic"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitePage;
