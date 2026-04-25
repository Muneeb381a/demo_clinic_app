import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosClient';
import { toast } from 'react-toastify';
import CreatableSelect from 'react-select/creatable';

const BASE_URL = "";

// Module-level cache: key = sorted symptom IDs joined, value = suggestion response
// Persists across re-renders, cleared when the page is refreshed
const suggestionCache = new Map();

const SymptomAnalysisSection = ({
  selectedSymptoms = [],
  onSymptomsChange,
  setSelectedMedicines,
  setSelectedTests,
  medicines = [],
  symptomsOptions = [],
}) => {
  // Initialise from parent-provided options — avoids a redundant /api/symptoms fetch
  const [symptoms, setSymptoms] = useState(symptomsOptions);
  const [isCreating, setIsCreating] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  // Keep local list in sync if parent refreshes symptoms after initial mount
  useEffect(() => {
    if (symptomsOptions.length > 0) {
      setSymptoms(symptomsOptions);
    }
  }, [symptomsOptions]);

  useEffect(() => {
    if (selectedSymptoms.length === 0) {
      setSuggestions(null);
      return;
    }
    const ids = selectedSymptoms.map((s) => Number(s.value)).filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) return;

    const cacheKey = [...ids].sort((a, b) => a - b).join(",");

    // Return cached result immediately — no spinner, no network
    if (suggestionCache.has(cacheKey)) {
      setSuggestions(suggestionCache.get(cacheKey));
      return;
    }

    const timer = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      try {
        const response = await axios.post(
          `${BASE_URL}/api/suggest/prescription`,
          { symptom_ids: ids },
        );
        suggestionCache.set(cacheKey, response.data);
        setSuggestions(response.data);
      } catch {
        // silently fail — suggestions are non-critical
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [selectedSymptoms]);

  const getFormDefaults = (form) => {
    const f = (form || 'Tablet').toLowerCase();
    if (f.includes('tablet')) {
      return { dosage_en: '1', dosage_urdu: 'ایک گولی', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
    }
    if (f.includes('capsule')) {
      return { dosage_en: '1', dosage_urdu: 'ایک گولی', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
    }
    if (['syrup', 'liquid', 'suspension', 'elixir'].some((t) => f.includes(t))) {
      return { dosage_en: 'one_spoon', dosage_urdu: 'ایک چمچ', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
    }
    if (['injection', 'injectable', 'iv', 'im'].some((t) => f.includes(t))) {
      return { dosage_en: 'one_injection', dosage_urdu: 'ایک ٹیکہ', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
    }
    if (['sachet', 'powder', 'granules'].some((t) => f.includes(t))) {
      return { dosage_en: 'one_sachet', dosage_urdu: 'ایک ساشے', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
    }
    if (f.includes('drop')) {
      return { dosage_en: 'two_droplets', dosage_urdu: 'دو قطرے', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
    }
    return { dosage_en: '1', dosage_urdu: 'ایک گولی', frequency_en: 'morning', frequency_urdu: 'صبح', duration_en: '7_days', duration_urdu: '1 ہفتہ (7 دن)', instructions_en: 'after_meal', instructions_urdu: 'کھانے کے بعد' };
  };

  const isMedicineAlreadyAdded = (medId) =>
    medicines.some((m) => String(m.medicine_id) === String(medId));

  const handleAddSuggestedMedicine = (med) => {
    if (!setSelectedMedicines) return;
    if (isMedicineAlreadyAdded(med.medicine_id)) {
      toast.info(`${med.brand_name || med.generic_name} is already in the prescription`);
      return;
    }
    setSelectedMedicines((prev) => {
      const defaults = getFormDefaults(med.form);
      return [
        ...prev,
        {
          medicine_id: Number(med.medicine_id),
          brand_name: med.brand_name || med.generic_name || 'Unknown',
          ...defaults,
        },
      ];
    });
    toast.success(`${med.brand_name || med.generic_name} added to prescription`);
  };

  const handleAddSuggestedTest = (test) => {
    if (!setSelectedTests) return;
    setSelectedTests((prev) => {
      const testIdStr = String(test.test_id);
      if (prev.includes(testIdStr)) {
        toast.info(`${test.test_name} is already added`);
        return prev;
      }
      toast.success(`${test.test_name} added to tests`);
      return [...prev, testIdStr];
    });
  };

  const handleCreateSymptom = async (inputValue) => {
    setIsCreating(true);
    try {
      const response = await axios.post(`${BASE_URL}/api/symptoms`, {
        name: inputValue,
      });
      const newSymptom = { value: response.data.id, label: response.data.name };
      setSymptoms((prev) => [...prev, newSymptom]);
      onSymptomsChange([...selectedSymptoms, newSymptom]);
    } catch (error) {
      toast.error('Failed to create symptom');
    } finally {
      setIsCreating(false);
    }
  };

  const confidenceColor = (ratio) => {
    if (ratio >= 0.75) return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' };
    if (ratio >= 0.5)  return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' };
    return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-600' };
  };

  const customStyles = {
    control: (base) => ({
      ...base,
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "8px 12px",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
      "&:hover": { borderColor: "#3b82f6" },
      "&:focus-within": {
        borderColor: "#3b82f6",
        boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "#eff6ff",
      borderRadius: "8px",
      padding: "2px 8px",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "#1d4ed8",
      fontWeight: "500",
      fontSize: "0.875rem",
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "#1d4ed8",
      ":hover": {
        backgroundColor: "#bfdbfe",
        borderRadius: "6px",
      },
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "12px",
      border: "1px solid #e5e7eb",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      marginTop: "8px",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#f0f9ff" : "white",
      color: state.isFocused ? "#0369a1" : "#1f2937",
      fontWeight: state.isFocused ? "500" : "400",
      ":active": { backgroundColor: "#e0f2fe" },
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af",
      fontSize: "0.875rem",
    }),
  };

  const hasResults = suggestions && (
    suggestions.diseases?.length > 0 ||
    suggestions.medicines?.length > 0 ||
    suggestions.tests?.length > 0
  );

  return (
    <div className="bg-white p-7 rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="bg-orange-600 p-3 rounded-xl text-white shadow-md hover:scale-105 transition-transform duration-200">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Symptom Analysis</h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">Select or create observed symptoms</p>
        </div>
      </div>

      <CreatableSelect
        isMulti
        options={symptoms}
        value={selectedSymptoms}
        onChange={onSymptomsChange}
        onCreateOption={handleCreateSymptom}
        placeholder="Search or type symptoms..."
        classNamePrefix="react-select"
        isClearable
        isLoading={isCreating}
        loadingMessage={() => "Creating symptom..."}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        styles={customStyles}
      />

      {/* Smart Suggestion Panel */}
      {selectedSymptoms.length > 0 && (
        <div className="mt-4 rounded-xl border border-indigo-100 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a5 5 0 01-7.072-7.072 5 5 0 017.072 0z" />
              </svg>
              <span className="text-sm font-semibold text-indigo-700">Smart Suggestions</span>
              {isFetchingSuggestions && (
                <span className="text-xs text-indigo-400 animate-pulse ml-1">Analyzing symptoms...</span>
              )}
            </div>
            {suggestions?.source && !isFetchingSuggestions && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                suggestions.source === 'ai'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {suggestions.source === 'ai' ? 'AI-based' : 'From history'}
              </span>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Loading skeleton */}
            {isFetchingSuggestions && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-indigo-100 rounded w-1/3" />
                <div className="flex gap-2">
                  <div className="h-7 bg-indigo-100 rounded-full w-24" />
                  <div className="h-7 bg-indigo-100 rounded-full w-32" />
                  <div className="h-7 bg-indigo-100 rounded-full w-20" />
                </div>
                <div className="h-3 bg-indigo-100 rounded w-1/4 mt-3" />
                <div className="flex gap-2">
                  <div className="h-8 bg-indigo-100 rounded-lg w-36" />
                  <div className="h-8 bg-indigo-100 rounded-lg w-28" />
                </div>
              </div>
            )}

            {/* Possible Conditions */}
            {!isFetchingSuggestions && suggestions?.diseases?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Possible Conditions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.diseases.map((d, i) => {
                    const pct = Math.round((d.match_ratio || 0) * 100);
                    const c = confidenceColor(d.match_ratio || 0);
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full font-medium ${c.bg} ${c.border} ${c.text}`}
                      >
                        <span>{d.disease_name}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>
                          {pct}%
                        </span>
                        {d.icd10_code && (
                          <span className="text-gray-400 font-normal">({d.icd10_code})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested Medicines */}
            {!isFetchingSuggestions && suggestions?.medicines?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Suggested Medicines
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.medicines.map((med, i) => {
                    const alreadyAdded = isMedicineAlreadyAdded(med.medicine_id);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => handleAddSuggestedMedicine(med)}
                        title={med.suggested_for?.length ? `For: ${med.suggested_for.join(', ')}` : undefined}
                        className={`group flex items-center gap-1.5 text-xs border px-3 py-1.5 rounded-lg font-medium transition-all shadow-sm ${
                          alreadyAdded
                            ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                            : 'bg-white border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700'
                        }`}
                      >
                        {alreadyAdded ? (
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-indigo-500 font-bold text-sm leading-none">+</span>
                        )}
                        <span>{med.form || 'Tablet'} {med.brand_name || med.generic_name}</span>
                        {med.strength && <span className="text-gray-400">({med.strength})</span>}
                        {med.is_first_line && !alreadyAdded && (
                          <span className="text-green-500 ml-0.5" title="First-line treatment">●</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  ● First-line &nbsp;·&nbsp; ✓ Already added &nbsp;·&nbsp; Hover for disease context
                </p>
              </div>
            )}

            {/* Suggested Tests */}
            {!isFetchingSuggestions && suggestions?.tests?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Suggested Tests
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.tests.map((test, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAddSuggestedTest(test)}
                      title={test.test_notes || undefined}
                      className="flex items-center gap-1.5 text-xs bg-white border border-teal-200 hover:border-teal-400 hover:bg-teal-50 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-all shadow-sm"
                    >
                      <span className="text-teal-500 font-bold text-sm leading-none">+</span>
                      <span>{test.test_name}</span>
                      {test.is_essential && (
                        <span className="text-teal-500 ml-0.5" title="Essential test">●</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">● Essential &nbsp;·&nbsp; Hover for notes</p>
              </div>
            )}

            {/* Empty state */}
            {!isFetchingSuggestions && suggestions && !hasResults && (
              <p className="text-xs text-gray-400">No suggestions found for the selected symptoms.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SymptomAnalysisSection;
