import React, { useState, useEffect, useRef } from "react";
import axios from "../utils/axiosClient";
import { toast } from "react-toastify";

const BASE_URL = "";

// ── Helpers ────────────────────────────────────────────────────────────────
const scoreColor = (s) =>
  s >= 0.75 ? "bg-green-100 text-green-700 border-green-200"
  : s >= 0.5 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
  : "bg-gray-100 text-gray-500 border-gray-200";

const scoreLabel = (s) =>
  s >= 0.75 ? "High match" : s >= 0.5 ? "Good match" : "Partial match";

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

// ── Skeleton loader ────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-xl border border-gray-100 p-4 animate-pulse">
        <div className="flex justify-between items-start mb-3">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    ))}
  </div>
);

// ── Single case card ───────────────────────────────────────────────────────
const CaseCard = ({ cas, inputSymptomIds, medicines, symptomsOptions, onApply }) => {
  const [expanded, setExpanded] = useState(false);
  const inputSet = new Set(inputSymptomIds.map(String));

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          {/* Score + date */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${scoreColor(cas.score)}`}>
              {Math.round(cas.score * 100)}% — {scoreLabel(cas.score)}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(cas.visit_date)}</span>
            <span className="text-xs text-gray-300">
              {cas.matched}/{cas.consult_total} symptoms matched
            </span>
          </div>

          {/* Diagnosis */}
          {cas.diagnosis ? (
            <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">
              {cas.diagnosis}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">No diagnosis recorded</p>
          )}
        </div>

        {/* Apply button */}
        <button
          onClick={() => onApply(cas)}
          className="flex-none text-sm font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          Apply
        </button>
      </div>

      {/* Symptom chips */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {(cas.symptoms || []).map((sym) => {
          const isMatched = inputSet.has(String(sym.id));
          return (
            <span
              key={sym.id}
              className={`text-xs px-2.5 py-0.5 rounded-full border ${
                isMatched
                  ? "bg-teal-50 border-teal-200 text-teal-700 font-medium"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}
            >
              {isMatched ? "✓ " : ""}{sym.name}
            </span>
          );
        })}
      </div>

      {/* Expandable medicines */}
      {cas.medicines?.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-gray-50 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <span>{cas.medicines.length} medicine{cas.medicines.length > 1 ? "s" : ""} prescribed</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-4 pb-3 space-y-2 border-t border-gray-50 pt-2">
              {cas.medicines.map((med, i) => {
                const inStore = medicines?.some((m) => m.value === String(med.medicine_id));
                return (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800 truncate">{med.name}</span>
                        {med.strength && <span className="text-xs text-gray-400">{med.strength}</span>}
                        {!inStore && (
                          <span className="text-xs text-red-400 bg-red-50 px-1.5 rounded">not in list</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-urdu leading-relaxed">
                        {med.dosage_urdu} · {med.frequency_urdu} · {med.duration_urdu} · {med.instructions_urdu}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const SimilarCasesPanel = ({
  selectedSymptoms = [],
  symptomsOptions  = [],
  medicines        = [],
  setSelectedMedicines,
  setNeuroExamData,
  onSymptomsChange,
}) => {
  const [cases, setCases]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(true);
  const [lastIds, setLastIds]   = useState("");
  const debounceRef             = useRef(null);

  const symptomIds = selectedSymptoms.map((s) => Number(s.value)).filter(Boolean);

  // Fetch similar cases whenever selected symptoms change (debounced 800ms)
  useEffect(() => {
    if (symptomIds.length < 2) {
      setCases([]);
      return;
    }
    const key = [...symptomIds].sort().join(",");
    if (key === lastIds) return; // same set — skip

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${BASE_URL}/api/suggest/similar-cases`, {
          params: { symptom_ids: key, limit: 5 },
        });
        if (data.success) {
          setCases(data.data);
          setLastIds(key);
          if (data.data.length > 0 && !open) setOpen(true);
        }
      } catch {
        // non-fatal — similar cases are a convenience feature
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => clearTimeout(debounceRef.current);
  }, [symptomIds.join(",")]); // eslint-disable-line

  // ── Apply a case to the consultation form ─────────────────────────────
  const handleApply = (cas) => {
    let applied = 0;

    // 1. Fill diagnosis
    if (cas.diagnosis) {
      setNeuroExamData((prev) => ({ ...prev, diagnosis: cas.diagnosis }));
      applied++;
    }

    // 2. Fill medicines (only those that exist in the Redux medicines store)
    const validMeds = (cas.medicines || []).filter((med) =>
      medicines.some((m) => m.value === String(med.medicine_id))
    );
    if (validMeds.length > 0) {
      setSelectedMedicines(
        validMeds.map((med) => ({
          medicine_id:       med.medicine_id,
          form:              med.form              || "Tablet",
          dosage_en:         med.dosage_en         || "1",
          dosage_urdu:       med.dosage_urdu       || "ایک گولی",
          frequency_en:      med.frequency_en      || "morning",
          frequency_urdu:    med.frequency_urdu    || "صبح",
          duration_en:       med.duration_en       || "7_days",
          duration_urdu:     med.duration_urdu     || "1 ہفتہ (7 دن)",
          instructions_en:   med.instructions_en   || "after_meal",
          instructions_urdu: med.instructions_urdu || "کھانے کے بعد",
        }))
      );
      applied++;
    }

    // 3. Optionally add any new symptoms from the case that aren't already selected
    const currentIds = new Set(selectedSymptoms.map((s) => String(s.value)));
    const newSymptoms = (cas.symptoms || [])
      .filter((sym) => !currentIds.has(String(sym.id)))
      .map((sym) => symptomsOptions.find((o) => o.value === sym.id || String(o.value) === String(sym.id)))
      .filter(Boolean);

    if (newSymptoms.length > 0) {
      onSymptomsChange([...selectedSymptoms, ...newSymptoms]);
    }

    const skipped = (cas.medicines?.length || 0) - validMeds.length;
    toast.success(
      `Applied: diagnosis + ${validMeds.length} medicine${validMeds.length !== 1 ? "s" : ""}` +
      (skipped > 0 ? ` (${skipped} medicine${skipped > 1 ? "s" : ""} not in your list — skipped)` : "")
    );
  };

  // Don't render if fewer than 2 symptoms selected
  if (symptomIds.length < 2 && cases.length === 0 && !loading) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 p-2 rounded-lg text-white">🔍</div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">Similar Past Cases</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading
                ? "Searching similar consultations…"
                : cases.length > 0
                ? `${cases.length} similar case${cases.length > 1 ? "s" : ""} found — click Apply to auto-fill`
                : symptomIds.length < 2
                ? "Select at least 2 symptoms to see similar cases"
                : "No similar cases found yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <svg className="animate-spin w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {cases.length > 0 && !loading && (
            <span className="text-xs bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
              {cases.length}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-3">
          {loading && cases.length === 0 && <Skeleton />}

          {!loading && cases.length === 0 && symptomIds.length >= 2 && (
            <div className="text-center py-6 text-gray-400">
              <span className="text-3xl block mb-2">📋</span>
              <p className="text-sm">No similar cases in records yet.</p>
              <p className="text-xs mt-1">As more consultations are saved, suggestions will appear here.</p>
            </div>
          )}

          {cases.map((cas) => (
            <CaseCard
              key={cas.consultation_id}
              cas={cas}
              inputSymptomIds={symptomIds}
              medicines={medicines}
              symptomsOptions={symptomsOptions}
              onApply={handleApply}
            />
          ))}

          {cases.length > 0 && (
            <p className="text-xs text-gray-400 text-center pt-1">
              Ranked by symptom overlap (Jaccard similarity). Data from your own clinic records.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SimilarCasesPanel;
