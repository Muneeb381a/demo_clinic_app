import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "../utils/axiosClient";
import { toast } from "react-toastify";

// ── Client-side helpers (mirrors backend normalisation) ────────────────────
const STOP = new Set([
  "the","a","an","is","are","was","has","have","with","and","or","for",
  "of","in","on","at","to","patient","doctor","complaint","complaining",
  "presenting","came","old","year","years","male","female","he","she",
  "his","her","this","that","also","since","past","last","ago","no","not",
]);
const clientKeywords = (text) =>
  [...new Set(
    text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  )].sort().join("|");

// Cheap 8-char hash to detect duplicate inputs before hitting the network
const quickHash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
};

const BASE_URL = "";

// ---------------------------------------------------------------------------
// Fuzzy name match — returns best match from options array or null
// options = [{ value, label, raw }]   (medicines store shape)
// options = [{ value, label }]        (symptoms / tests store shape)
// ---------------------------------------------------------------------------
const fuzzyFind = (name, options, key = "label") => {
  if (!name || !options?.length) return null;
  const needle = name.toLowerCase().trim();
  // 1. Exact match
  let found = options.find((o) => (o[key] || "").toLowerCase() === needle);
  if (found) return found;
  // 2. Starts with
  found = options.find((o) => (o[key] || "").toLowerCase().startsWith(needle));
  if (found) return found;
  // 3. Contains
  found = options.find((o) => (o[key] || "").toLowerCase().includes(needle));
  if (found) return found;
  // 4. Also check raw.generic_name / raw.brand_name for medicines
  found = options.find((o) => {
    const g = (o.raw?.generic_name || "").toLowerCase();
    const b = (o.raw?.brand_name  || "").toLowerCase();
    return g === needle || b === needle || g.includes(needle) || b.includes(needle);
  });
  return found || null;
};

// ---------------------------------------------------------------------------
// Confidence badge colour
// ---------------------------------------------------------------------------
const confidenceColor = (c) => {
  if (c >= 0.75) return "bg-green-100 text-green-700";
  if (c >= 0.5)  return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const MedicalChatbot = ({
  medicines = [],
  symptomsOptions = [],
  tests = [],
  selectedMedicines = [],
  setSelectedMedicines,
  selectedSymptoms = [],
  onSymptomsChange,
  selectedTests = [],
  onTestsChange,
  setNeuroExamData,
}) => {
  const [open, setOpen]           = useState(false);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [debouncing, setDebouncing] = useState(false); // user still typing
  const [cacheLevel, setCacheLevel] = useState(null);  // "L1"|"L2"|"L3"|null

  const textareaRef       = useRef(null);
  const debounceTimer     = useRef(null);
  const lastKeywordHash   = useRef("");  // keyword hash of last SUCCESSFUL analysis
  const resultCache       = useRef(new Map()); // session-level: keyHash → result

  // ── Debounce: mark "still typing" while doctor edits ──────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    setDebouncing(true);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncing(false), 1200);
  };

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Track which medicines/symptoms/tests have already been added this session
  const addedMedIds  = new Set(selectedMedicines.map((m) => String(m.medicine_id)));
  const addedSymIds  = new Set(selectedSymptoms.map((s) => String(s.value)));
  const addedTestIds = new Set(selectedTests.map((t) => String(typeof t === "object" ? t.value : t)));

  // ── Analyze ────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 5) return;

    // ── 1. Skip if same keyword set was already analyzed this session ──
    const kwHash = quickHash(clientKeywords(trimmed));
    if (kwHash === lastKeywordHash.current && result) {
      toast.info("Same symptoms — showing existing result");
      return;
    }

    // ── 2. Session-level client cache (survives re-renders, cleared on refresh) ──
    if (resultCache.current.has(kwHash)) {
      setResult(resultCache.current.get(kwHash));
      setCacheLevel("session");
      lastKeywordHash.current = kwHash;
      return;
    }

    setLoading(true);
    setResult(null);
    setCacheLevel(null);
    try {
      const { data } = await axios.post(`${BASE_URL}/api/chatbot/analyze`, { input: trimmed });
      if (data.success) {
        setResult(data.data);
        setCacheLevel(data.cacheLevel);
        resultCache.current.set(kwHash, data.data);
        lastKeywordHash.current = kwHash;
      } else {
        toast.error(data.message || "Analysis failed");
      }
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 429 ? "Gemini API quota exceeded. Wait until midnight (PT) or upgrade your Google AI plan." :
        status === 503 ? "AI service not configured. Set GOOGLE_API_KEY in Vercel." :
        status === 401 ? "Invalid API key. Check GOOGLE_API_KEY in Vercel settings." :
        err.response?.data?.message || "Failed to connect to AI service";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [input, result]);

  // ── Auto-fill helpers ──────────────────────────────────────────────────
  const fillDiagnosis = () => {
    if (!result?.diagnosis_text) return;
    setNeuroExamData((prev) => ({ ...prev, diagnosis: result.diagnosis_text }));
    toast.success("Diagnosis filled");
  };

  const addMedicine = (med) => {
    const match = fuzzyFind(med.name, medicines);
    if (!match) {
      toast.warn(`Medicine "${med.name}" not found in your list. Add it first.`);
      return;
    }
    if (addedMedIds.has(String(match.value))) {
      toast.info(`${med.name} already in prescription`);
      return;
    }
    setSelectedMedicines((prev) => [
      ...prev,
      {
        medicine_id:       match.value,
        form:              match.raw?.form || "Tablet",
        dosage_en:         med.dosage_en        || "1",
        dosage_urdu:       med.dosage_urdu      || "ایک گولی",
        frequency_en:      med.frequency_en     || "morning",
        frequency_urdu:    med.frequency_urdu   || "صبح",
        duration_en:       med.duration_en      || "7_days",
        duration_urdu:     med.duration_urdu    || "1 ہفتہ (7 دن)",
        instructions_en:   med.instructions_en  || "after_meal",
        instructions_urdu: med.instructions_urdu || "کھانے کے بعد",
      },
    ]);
    addedMedIds.add(String(match.value));
    toast.success(`${med.name} added to prescription`);
  };

  const addAllMedicines = () => {
    if (!result?.medicines?.length) return;
    result.medicines.forEach(addMedicine);
  };

  const addSymptom = (name) => {
    const match = fuzzyFind(name, symptomsOptions);
    if (!match) { toast.warn(`Symptom "${name}" not found`); return; }
    if (addedSymIds.has(String(match.value))) { toast.info(`${name} already added`); return; }
    onSymptomsChange([...selectedSymptoms, match]);
    addedSymIds.add(String(match.value));
    toast.success(`Symptom "${name}" added`);
  };

  const toggleTest = (name) => {
    const match = fuzzyFind(name, tests);
    if (!match) { toast.warn(`Test "${name}" not found`); return; }
    const id = String(match.value);
    if (addedTestIds.has(id)) { toast.info(`${name} already added`); return; }
    onTestsChange([...selectedTests, match.value]);
    addedTestIds.add(id);
    toast.success(`Test "${name}" added`);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2 rounded-lg text-white text-lg">🤖</div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">AI Clinical Assistant</h3>
            <p className="text-xs text-gray-400 mt-0.5">Describe symptoms in natural language → get diagnosis & Rx suggestions</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          {/* Input */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-600">
                Describe patient symptoms / clinical notes
              </label>
              {/* Cache level badge — only shown after a result */}
              {cacheLevel && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  cacheLevel === "session" ? "bg-purple-100 text-purple-700" :
                  cacheLevel === "L1"      ? "bg-green-100  text-green-700"  :
                  cacheLevel === "L2"      ? "bg-blue-100   text-blue-700"   :
                  cacheLevel === "L3"      ? "bg-amber-100  text-amber-700"  :
                                             "bg-gray-100   text-gray-500"
                }`}>
                  {cacheLevel === "session" ? "⚡ Session cache" :
                   cacheLevel === "L1"      ? "⚡ Memory cache"  :
                   cacheLevel === "L2"      ? "⚡ Redis cache"   :
                   cacheLevel === "L3"      ? "⚡ DB cache"      : "🤖 Fresh AI"}
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAnalyze();
              }}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Patient has fever 38.5°C, sore throat, productive cough for 3 days. No known allergies."
              className="w-full rounded-xl border-2 border-gray-100 p-3 text-sm resize-none focus:border-violet-300 focus:outline-none transition-colors"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {input.length}/1000
                {debouncing && <span className="ml-2 text-violet-400 animate-pulse">● typing…</span>}
                {!debouncing && input.trim().length >= 5 && !loading && (
                  <span className="ml-2 text-gray-400">· Ctrl+Enter to analyze</span>
                )}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={loading || debouncing || input.trim().length < 5}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  loading
                    ? "bg-violet-400 text-white cursor-wait"
                    : debouncing || input.trim().length < 5
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm hover:shadow-md"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analyzing…
                  </>
                ) : debouncing ? "…" : "✨ Analyze"}
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">

              {/* Diagnoses */}
              {result.diagnoses?.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-blue-800">Possible Diagnoses</h4>
                    <button
                      onClick={fillDiagnosis}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Fill Diagnosis Field
                    </button>
                  </div>
                  {result.diagnoses.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-blue-900">{d.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceColor(d.confidence)}`}>
                        {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                  {result.diagnosis_text && (
                    <p className="text-xs text-blue-600 pt-1 border-t border-blue-100">{result.diagnosis_text}</p>
                  )}
                </div>
              )}

              {/* Symptoms */}
              {result.symptoms_extracted?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Extracted Symptoms</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.symptoms_extracted.map((s, i) => {
                      const match  = fuzzyFind(s, symptomsOptions);
                      const isAdded = match && addedSymIds.has(String(match.value));
                      return (
                        <button
                          key={i}
                          onClick={() => match && addSymptom(s)}
                          disabled={!match || isAdded}
                          title={!match ? "Not in your symptom list" : isAdded ? "Already added" : "Click to add"}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            isAdded
                              ? "bg-green-50 border-green-200 text-green-700 cursor-default"
                              : match
                              ? "bg-white border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer"
                              : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {isAdded ? "✓ " : ""}{s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Medicines */}
              {result.medicines?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">Suggested Medicines</h4>
                    <button
                      onClick={addAllMedicines}
                      className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Add All to Rx
                    </button>
                  </div>
                  <div className="space-y-2">
                    {result.medicines.map((med, i) => {
                      const match   = fuzzyFind(med.name, medicines);
                      const isAdded = match && addedMedIds.has(String(match.value));
                      return (
                        <div
                          key={i}
                          className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                            isAdded ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">{med.name}</span>
                              {!match && (
                                <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                                  Not in list
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-xs text-gray-500">{med.dosage_urdu}</span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{med.frequency_urdu}</span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{med.duration_urdu}</span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{med.instructions_urdu}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => addMedicine(med)}
                            disabled={!match || isAdded}
                            className={`flex-none text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                              isAdded
                                ? "bg-green-100 text-green-700 cursor-default"
                                : !match
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-emerald-500 text-white hover:bg-emerald-600"
                            }`}
                          >
                            {isAdded ? "✓ Added" : "+ Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tests */}
              {result.tests_recommended?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Recommended Tests</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.tests_recommended.map((t, i) => {
                      const match   = fuzzyFind(t, tests);
                      const isAdded = match && addedTestIds.has(String(match.value));
                      return (
                        <button
                          key={i}
                          onClick={() => match && toggleTest(t)}
                          disabled={!match || isAdded}
                          title={!match ? "Not in your test list" : isAdded ? "Already added" : "Click to add"}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            isAdded
                              ? "bg-teal-50 border-teal-200 text-teal-700 cursor-default"
                              : match
                              ? "bg-white border-gray-200 text-gray-700 hover:bg-teal-50 hover:border-teal-300 cursor-pointer"
                              : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {isAdded ? "✓ " : ""}{t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Precautions */}
              {result.precautions?.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                  <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Precautions</h4>
                  <ul className="space-y-1">
                    {result.precautions.map((p, i) => (
                      <li key={i} className="text-xs text-amber-800 flex gap-2">
                        <span>•</span><span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-gray-400 text-center border-t pt-3">
                AI suggestions are for clinical support only. Always apply your own medical judgment.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalChatbot;
