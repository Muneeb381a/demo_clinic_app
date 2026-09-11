import React from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../utils/auth";

// Route-level permission guard. The backend is the real authority (every
// clinical-write endpoint already rejects the wrong role) — this just keeps
// a receptionist who navigates straight to a doctor-only URL (a stale link,
// a typed address) from landing on a broken/erroring form instead of a
// clear "you can't do this" screen.
//
//   <Route path="..." element={
//     <RequireRole allow={(user) => user?.role === "doctor"}>
//       <PatientConsultation />
//     </RequireRole>
//   } />
const RequireRole = ({ allow, children }) => {
  const navigate = useNavigate();
  const user = getUser();

  if (allow(user)) return children;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-sm text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          You don't have access to this page
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          This area is restricted based on your role in this clinic.
        </p>
        <button
          onClick={() => navigate("/patients")}
          className="py-2 px-5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Back to patients
        </button>
      </div>
    </div>
  );
};

export const isDoctor = (user) => user?.role === "doctor" || user?.role === "platform_admin";
export const isOwner = (user) => Boolean(user?.is_owner);

export default RequireRole;
