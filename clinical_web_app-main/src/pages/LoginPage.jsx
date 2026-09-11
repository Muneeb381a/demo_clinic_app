import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaUserDoctor, FaCalendarCheck, FaFileWaveform } from "react-icons/fa6";
import { login } from "../utils/auth";
import { fetchWithRetry } from "../utils/api";
import { getSubdomainSlug } from "../utils/tenant";

const FEATURES = [
  { icon: FaUserDoctor, label: "One record per patient, shared across your team" },
  { icon: FaCalendarCheck, label: "Follow-ups and schedules that never slip" },
  { icon: FaFileWaveform, label: "Prescriptions and history, ready to print" },
];

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Per-clinic subdomain branding — inert (stays null) until the app is
  // deployed under a real wildcard domain; see src/utils/tenant.js.
  const [clinicName, setClinicName] = useState(null);

  useEffect(() => {
    const slug = getSubdomainSlug();
    if (!slug) return;
    fetchWithRetry(
      "get",
      `/api/public/clinics/by-slug/${slug}`,
      `clinic-branding:${slug}`,
      null,
      (data) => data?.clinic?.name || null
    )
      .then(setClinicName)
      .catch(() => {}); // unknown/suspended slug — fall back to generic branding
  }, []);

  const brandName = clinicName || "Clinic Management";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      onLogin?.();
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Branded panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-600 to-indigo-700 text-white flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute w-96 h-96 rounded-full bg-white -top-32 -left-32" />
          <div className="absolute w-72 h-72 rounded-full bg-white bottom-0 right-0 translate-x-1/3 translate-y-1/3" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-bold text-lg">
            {brandName.charAt(0).toUpperCase()}
          </div>
          <span className="text-lg font-semibold tracking-wide">{brandName}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Everything your clinic needs, in one place.
          </h1>
          <p className="text-teal-50/90 text-base mb-8 max-w-md">
            Patients, consultations, prescriptions and follow-ups — organized for
            every doctor and receptionist on your team.
          </p>
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-teal-50/95">
                <span className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </motion.div>

        <p className="relative text-xs text-teal-100/70">
          &copy; {new Date().getFullYear()} Clinic Management System
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {brandName.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-100">{brandName}</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {clinicName ? `Sign in to continue to ${clinicName}` : "Sign in to continue to your clinic"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm transition-shadow"
                  placeholder="you@clinic.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm transition-shadow"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium rounded-xl transition-colors text-sm shadow-sm shadow-teal-600/20 flex items-center justify-center gap-2 mt-1"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
