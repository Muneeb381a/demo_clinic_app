import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, matchPath } from "react-router-dom";
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
import PlatformAdminPage from "./pages/PlatformAdminPage";
import ClinicStaffPage from "./pages/ClinicStaffPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import RequireRole, { isDoctor, isOwner } from "./components/RequireRole";
import { hasFeature } from "./utils/features";
import { bootstrapSession, getUser, logout as logoutSession } from "./utils/auth";
import FullPageLoader from "./pages/FullPageLoader";

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

  const isDashboard = location.pathname === "/";

  return (
    <>
      {!isDashboard && (
        <header className="sticky top-0 z-10 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-8xl mx-auto px-4 py-2 flex justify-between items-center">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 group shrink-0"
              title="Dashboard"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                C
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-100 hidden sm:inline">
                Clinic
              </span>
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <TimeGreeting locale="en-PK" timeZone="Asia/Karachi" />
              <NavLink to="/patients" currentPath={location.pathname}>
                Patients
              </NavLink>
              {getUser()?.is_owner && (
                <NavLink to="/staff" currentPath={location.pathname}>
                  Staff
                </NavLink>
              )}
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
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/patients" element={<PatientSearch />} />
        <Route path="/patients/:patientId" element={<PatientSearch />} />
        <Route path="/patients/new" element={<PatientSearch />} />
        <Route
          path="/patients/:patientId/consultation"
          element={<RequireRole allow={isDoctor}><PatientConsultation /></RequireRole>}
        />
        <Route path="/patients/:patientId/history" element={<PatientHistory />} />
        <Route
          path="/patients/:patientId/consultations/:consultationId/edit"
          element={<RequireRole allow={isDoctor}><EditConsultation /></RequireRole>}
        />
        <Route
          path="/patients/:patientId/consultations/new"
          element={<RequireRole allow={isDoctor}><PatientConsultation /></RequireRole>}
        />
        <Route
          path="/patients/:patientId/tests/new"
          element={<RequireRole allow={isDoctor}><AddTestForm /></RequireRole>}
        />
        <Route
          path="/staff"
          element={<RequireRole allow={isOwner}><ClinicStaffPage /></RequireRole>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {hasFeature(getUser(), "chatbot") && <FloatingChatbot />}
    </>
  );
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("darkMode") === "true"; } catch { return false; }
  });

  // null = still checking the refresh cookie; true/false once known.
  const [authed, setAuthed] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    // One-time: drop any legacy token from the old localStorage-based auth.
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    } catch { /* ignore */ }
    bootstrapSession().then((user) => {
      setAuthed(!!user);
      setRole(user?.role || null);
    });
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try { localStorage.setItem("darkMode", String(darkMode)); } catch {}
  }, [darkMode]);

  const handleLogout = async () => {
    await logoutSession();
    setAuthed(false);
    setRole(null);
  };

  // Public regardless of auth state — a brand-new staff member has no
  // account yet, and an already-logged-in owner might open their own link.
  const joinMatch = matchPath("/join/:token", location.pathname);
  if (joinMatch) {
    return (
      <AcceptInvitePage
        token={joinMatch.params.token}
        onAccepted={() => {
          setAuthed(true);
          setRole(getUser()?.role || null);
          navigate("/", { replace: true });
        }}
      />
    );
  }

  if (authed === null) {
    return <FullPageLoader isLoading />;
  }

  if (!authed) {
    return (
      <LoginPage
        onLogin={() => {
          setAuthed(true);
          setRole(getUser()?.role || null);
        }}
      />
    );
  }

  // Platform admins provision clinics — they don't use the clinical app.
  if (role === "platform_admin") {
    return <PlatformAdminPage onLogout={handleLogout} />;
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
