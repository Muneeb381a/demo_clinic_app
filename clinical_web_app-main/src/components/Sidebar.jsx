import React, { useState } from "react";
import { NavLink as RouterNavLink } from "react-router-dom";
import {
  FaGauge, FaHospitalUser, FaFileInvoiceDollar, FaSackDollar, FaBedPulse,
  FaHouseMedical, FaUsers, FaBars, FaXmark, FaSun, FaMoon, FaRightFromBracket,
  FaHospital,
} from "react-icons/fa6";
import { hasFeature } from "../utils/features";

const canBill = (user) => hasFeature(user, "billing");
const canManageFees = (user) => hasFeature(user, "billing") && Boolean(user?.is_owner);
const canIpd = (user) => hasFeature(user, "ipd");
const canManageWards = (user) => hasFeature(user, "ipd") && Boolean(user?.is_owner);

const navItems = (user) => [
  { to: "/", label: "Dashboard", icon: FaGauge, show: true, end: true },
  { to: "/patients", label: "Patients", icon: FaHospitalUser, show: true },
  { to: "/billing", label: "Billing", icon: FaFileInvoiceDollar, show: canBill(user) },
  { to: "/billing/fees", label: "Fees", icon: FaSackDollar, show: canManageFees(user) },
  { to: "/ipd", label: "Beds", icon: FaBedPulse, show: canIpd(user) },
  { to: "/ipd/wards", label: "Wards", icon: FaHouseMedical, show: canManageWards(user) },
  { to: "/staff", label: "Staff", icon: FaUsers, show: Boolean(user?.is_owner) },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
    isActive
      ? "bg-teal-600 text-white shadow-sm"
      : "text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400"
  }`;

const Sidebar = ({ user, darkMode, onToggleDark, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItems(user).filter((i) => i.show);

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
          <FaHospital className="w-4 h-4" />
        </div>
        <span className="font-bold text-gray-800 dark:text-white tracking-tight">Clinic Management</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, end }) => (
          <RouterNavLink key={to} to={to} end={end} className={linkClass} onClick={() => setMobileOpen(false)}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </RouterNavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
            {(user?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize truncate">
              {user?.role}{user?.is_owner ? " · Owner" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleDark}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {darkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
          {darkMode ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
        >
          <FaRightFromBracket className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
            <FaHospital className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-gray-800 dark:text-white text-sm">Clinic Management</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-500 dark:text-gray-400" aria-label="Open menu">
          <FaBars className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[80%] bg-white dark:bg-gray-800 h-full shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Close menu"
            >
              <FaXmark className="w-5 h-5" />
            </button>
            {body}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700">
        {body}
      </aside>
    </>
  );
};

export default Sidebar;
