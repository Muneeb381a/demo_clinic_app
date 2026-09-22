import React from "react";
import { motion } from "framer-motion";
import { FaClock, FaEnvelope } from "react-icons/fa6";

// Shown instead of the app once the backend reports clinic.trial_expired.
// Purely informational — the real gate is the backend's requireTrialActive
// middleware, which already blocked every other request by the time this
// renders; this page just explains why, on-brand instead of a raw error.
const TrialExpiredPage = ({ user, onLogout }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-sm text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8"
    >
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm mb-5">
        <FaClock className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Your trial has ended</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {user?.clinic ? "This clinic's" : "Your"} 7-day trial period is over. Your data is safe —
        get in touch to continue with a full account.
      </p>
      <a
        href="mailto:hello@clinicmanagement.app"
        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors text-sm shadow-sm shadow-teal-600/20 mb-3"
      >
        <FaEnvelope className="w-4 h-4" />
        Contact us to continue
      </a>
      <button
        onClick={onLogout}
        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        Logout
      </button>
    </motion.div>
  </div>
);

export default TrialExpiredPage;
