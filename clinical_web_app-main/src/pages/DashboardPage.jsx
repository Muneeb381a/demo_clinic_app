import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchDashboardStats, selectDashboard } from "../store/slices/dashboardSlice";

// ── Horizontal bar chart for analytics ────────────────────────────────────────
const HBarChart = ({ data, color }) => {
  if (!data || data.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No data yet.</p>;
  const max = Math.max(...data.map((d) => Number(d.count)), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-32 truncate flex-shrink-0 text-right" title={item.name}>{item.name}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`${color} h-4 rounded-full transition-all duration-500`}
              style={{ width: `${(Number(item.count) / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-6 text-right flex-shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, sub }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-4 hover:shadow-md transition-shadow`}>
    <div className={`${color} p-3 rounded-xl text-white shadow-md flex-shrink-0`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1 leading-none">
        {value ?? <span className="text-gray-300 dark:text-gray-600 text-2xl">—</span>}
      </p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  </div>
);

// ── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title, icon }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-gray-400 dark:text-gray-500">{icon}</span>
    <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
  </div>
);

// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
);

// ── Gender badge ──────────────────────────────────────────────────────────────
const GenderBadge = ({ gender }) => {
  const map = {
    male: "bg-blue-50 text-blue-600",
    female: "bg-pink-50 text-pink-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[gender?.toLowerCase()] || "bg-gray-100 text-gray-500"}`}>
      {gender || "—"}
    </span>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { counts, recent_patients, upcoming_followups, monthly_trend, top_medicines, top_symptoms, loading, error } = useSelector(selectDashboard);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  const handleRefresh = () => dispatch(fetchDashboardStats(true));

  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("darkMode", String(next)); } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-teal-600 to-indigo-600 px-6 py-8 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-teal-100 text-sm mt-1">Clinic overview at a glance</p>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <button
                onClick={toggleDark}
                title={darkMode ? "Light mode" : "Dark mode"}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                {darkMode ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 bg-white text-teal-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-50 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Patients
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Failed to load dashboard data. {error}
          </div>
        )}

        {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !counts.total_patients ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                label="Total Patients"
                value={counts.total_patients}
                sub="All time"
                color="bg-teal-600"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Today's Consultations"
                value={counts.today_consultations}
                sub="Since midnight"
                color="bg-indigo-600"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
              />
              <StatCard
                label="New Patients This Week"
                value={counts.new_patients_this_week}
                sub="Since Monday"
                color="bg-emerald-600"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                }
              />
              <StatCard
                label="Upcoming Follow-ups"
                value={counts.upcoming_followups_count}
                sub="Next 7 days"
                color="bg-amber-500"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
            </>
          )}
        </div>

        {/* ── Bottom Grid: Recent Patients + Upcoming Follow-ups ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Recent Patients — 3 cols */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <SectionHeader
              title="Recent Patients"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />

            {loading && recent_patients.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recent_patients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No patients yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 pb-3">Name</th>
                      <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 pb-3">Age</th>
                      <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 pb-3">Gender</th>
                      <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 pb-3">Registered</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {recent_patients.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[140px]">{p.name}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{p.mr_no}</div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{p.age ?? "—"}</td>
                        <td className="py-3 pr-4"><GenderBadge gender={p.gender} /></td>
                        <td className="py-3 pr-4 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">{p.registered_on}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => navigate(`/patients/${p.id}/consultation`)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                          >
                            Consult →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upcoming Follow-ups — 2 cols */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <SectionHeader
              title="Upcoming Follow-ups"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />

            {loading && upcoming_followups.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : upcoming_followups.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-400">No upcoming follow-ups in the next 7 days.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming_followups.map((f) => {
                  const isToday = f.follow_up_date === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={f.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-shadow ${isToday ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}
                      onClick={() => navigate(`/patients/${f.patient_id}/consultation`)}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isToday ? "bg-amber-500" : "bg-indigo-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 text-sm truncate">{f.patient_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{f.notes}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${isToday ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"}`}>
                        {isToday ? "Today" : f.formatted_date}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Monthly Trend ─────────────────────────────────────────────────── */}
        {monthly_trend.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <SectionHeader
              title="Consultations — Last 6 Months"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <div className="flex items-end gap-3 h-32 mt-2">
              {(() => {
                const max = Math.max(...monthly_trend.map((m) => Number(m.consultations)), 1);
                return monthly_trend.map((m, i) => {
                  const pct = Math.max((Number(m.consultations) / max) * 100, 4);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-xs font-semibold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.consultations}
                      </span>
                      <div className="w-full relative">
                        <div
                          className="w-full bg-indigo-500 rounded-t-lg transition-all duration-500 hover:bg-indigo-600"
                          style={{ height: `${(pct / 100) * 96}px` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{m.month}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ── Analytics: Top Medicines + Top Symptoms ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <SectionHeader
              title="Top 10 Prescribed Medicines"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              }
            />
            {loading && top_medicines.length === 0 ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : (
              <HBarChart data={top_medicines} color="bg-indigo-500" />
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <SectionHeader
              title="Top 10 Reported Symptoms"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            {loading && top_symptoms.length === 0 ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : (
              <HBarChart data={top_symptoms} color="bg-teal-500" />
            )}
          </div>
        </div>

        {/* ── Quick Actions ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Search Patient", icon: "🔍", path: "/" },
            { label: "Add Patient", icon: "➕", path: "/patients/new" },
            { label: "Today's Schedule", icon: "📅", path: "/" },
            { label: "Refresh Stats", icon: "🔄", action: handleRefresh },
          ].map(({ label, icon, path, action }) => (
            <button
              key={label}
              onClick={action || (() => navigate(path))}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 text-center hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500 transition-all group"
            >
              <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">{icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
