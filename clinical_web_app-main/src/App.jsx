import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  fetchSymptoms,
  fetchTests,
  fetchMedicines,
  fetchNeuroOptions,
} from "./store/slices/appDataSlice";
import TimeGreeting from "./components/TimeGreeting";
import PatientSearch from "./components/PatientSearch";
import PatientConsultation from "./components/PatientConsultation";
import PatientHistory from "./components/PatientHistoryModal";
import EditConsultation from "./components/EditConsultation";
import AddTestForm from "./components/AddTestForm";
import DashboardPage from "./pages/DashboardPage";
import FloatingChatbot from "./components/FloatingChatbot";
import LoginPage from "./pages/LoginPage";

const NavLink = ({ to, children, currentPath }) => {
  const navigate = useNavigate();
  const active = currentPath === to;
  return (
    <button
      onClick={() => navigate(to)}
      className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
        active
          ? "bg-teal-600 text-white"
          : "text-gray-600 dark:text-gray-300 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 border border-gray-200 dark:border-gray-600"
      }`}
    >
      {children}
    </button>
  );
};

const AppShell = ({ darkMode, onToggleDark, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchSymptoms());
    dispatch(fetchTests());
    dispatch(fetchMedicines());
    dispatch(fetchNeuroOptions());
  }, [dispatch]);

  const isDashboard = location.pathname === "/dashboard";

  return (
    <>
      {!isDashboard && (
        <header className="sticky top-0 z-10">
          <div className="max-w-8xl mx-auto px-4 py-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
            </div>
            <div className="flex items-center gap-3">
              <TimeGreeting locale="en-PK" timeZone="Asia/Karachi" />
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      <Routes>
        <Route path="/" element={<PatientSearch />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients/:patientId" element={<PatientSearch />} />
        <Route path="/patients/new" element={<PatientSearch />} />
        <Route path="/patients/:patientId/consultation" element={<PatientConsultation />} />
        <Route path="/patients/:patientId/history" element={<PatientHistory />} />
        <Route path="/patients/:patientId/consultations/:consultationId/edit" element={<EditConsultation />} />
        <Route path="/patients/:patientId/consultations/new" element={<PatientConsultation />} />
        <Route path="/patients/:patientId/tests/new" element={<AddTestForm />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <FloatingChatbot />
    </>
  );
};

const App = () => {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("darkMode") === "true"; } catch { return false; }
  });

  const [authed, setAuthed] = useState(() => !!localStorage.getItem("auth_token"));

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try { localStorage.setItem("darkMode", String(darkMode)); } catch {}
  }, [darkMode]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthed(false);
  };

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <AppShell
      darkMode={darkMode}
      onToggleDark={() => setDarkMode((d) => !d)}
      onLogout={handleLogout}
    />
  );
};

export default App;
