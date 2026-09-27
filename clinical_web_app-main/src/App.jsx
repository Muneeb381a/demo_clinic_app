import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, matchPath } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  fetchSymptoms,
  fetchTests,
  fetchMedicines,
  fetchNeuroOptions,
} from "./store/slices/appDataSlice";
import Sidebar from "./components/Sidebar";
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
import BillingPage from "./pages/BillingPage";
import FeeSettingsPage from "./pages/FeeSettingsPage";
import IpdPage from "./pages/IpdPage";
import WardSetupPage from "./pages/WardSetupPage";
import RequireRole, { isDoctor, isOwner } from "./components/RequireRole";
import TrialExpiredPage from "./pages/TrialExpiredPage";
import { hasFeature, isTrialExpired, trialDaysLeft } from "./utils/features";
import { bootstrapSession, getUser, logout as logoutSession } from "./utils/auth";
import FullPageLoader from "./pages/FullPageLoader";

const canBill = (user) => hasFeature(user, "billing");
const canManageFees = (user) => hasFeature(user, "billing") && Boolean(user?.is_owner);

const canIpd = (user) => hasFeature(user, "ipd");
const canManageWards = (user) => hasFeature(user, "ipd") && Boolean(user?.is_owner);

const AppShell = ({ darkMode, onToggleDark, onLogout }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchSymptoms());
    dispatch(fetchTests());
    dispatch(fetchMedicines());
    dispatch(fetchNeuroOptions());
  }, [dispatch]);

  const daysLeft = trialDaysLeft(getUser());

  return (
    <div className="lg:flex">
      <Sidebar user={getUser()} darkMode={darkMode} onToggleDark={onToggleDark} onLogout={onLogout} />

      <div className="flex-1 min-w-0">
        {daysLeft != null && (
          <div className="bg-amber-500 text-white text-xs sm:text-sm text-center py-1.5 px-4">
            Trial account — {daysLeft} day{daysLeft === 1 ? "" : "s"} left. Contact us to continue after that.
          </div>
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
          <Route path="/billing" element={<RequireRole allow={canBill}><BillingPage /></RequireRole>} />
          <Route path="/billing/fees" element={<RequireRole allow={canManageFees}><FeeSettingsPage /></RequireRole>} />
          <Route path="/ipd" element={<RequireRole allow={canIpd}><IpdPage /></RequireRole>} />
          <Route path="/ipd/wards" element={<RequireRole allow={canManageWards}><WardSetupPage /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {hasFeature(getUser(), "chatbot") && <FloatingChatbot />}
    </div>
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

  // Credentials are still valid — only the clinic's trial window is up.
  // Computed server-side (see utils/features.js); nothing client-side can
  // forge past this, since every real endpoint is independently blocked by
  // the backend's requireTrialActive regardless of what this page shows.
  if (isTrialExpired(getUser())) {
    return <TrialExpiredPage user={getUser()} onLogout={handleLogout} />;
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
