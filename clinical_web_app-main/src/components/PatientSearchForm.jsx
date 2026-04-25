import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { fetchWithRetry } from "../utils/api";
import { toast } from "react-toastify";

const searchSchema = z.object({
  search: z
    .string()
    .min(1, "Please enter a mobile number or name")
    .refine((val) => {
      // Allow both numbers and names during typing
      const trimmedVal = val.trim();
      const isNumber = /^[0-9]*$/.test(trimmedVal);
      const isName = /^[a-zA-Z\s]*$/.test(trimmedVal);
      return isNumber || isName;
    }, "Enter a valid mobile number (digits only) or name (letters only)"),
});

const PatientSearchForm = ({ onSearch, isSearching }) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(searchSchema),
    mode: "onBlur", // Only validate on blur to prevent typing errors
  });

  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isTypingNumber, setIsTypingNumber] = useState(false);
  const searchInput = watch("search") || "";
  const [debouncedSearch] = useDebounce(searchInput, 300);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Detect if user is typing a number
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed && /^[0-9]+$/.test(trimmed)) {
      setIsTypingNumber(true);
      setShowDropdown(false);
      setSuggestions([]);
    } else {
      setIsTypingNumber(false);
    }
  }, [searchInput]);

  // Fetch suggestions for name input only
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!navigator.onLine) {
        toast.error(
          "📡 You are offline. Please check your network connection.",
        );
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      const trimmedSearch = debouncedSearch.trim();

      // Only fetch suggestions for names (not numbers) and with at least 2 characters
      const isName = /^[a-zA-Z\s]{2,}$/.test(trimmedSearch);

      if (!trimmedSearch || isTypingNumber || !isName) {
        setSuggestions([]);
        setShowDropdown(false);
        setHighlightedIndex(-1);
        return;
      }

      setIsSuggesting(true);
      try {
        const suggestionRes = await fetchWithRetry(
          "get",
          `/api/patients/suggest?name=${encodeURIComponent(trimmedSearch)}`,
          `patient-suggestions:${trimmedSearch.toLowerCase()}`,
          null,
          (data) => {
            if (!data?.success || !Array.isArray(data.data)) {
              return { success: false, data: [] };
            }
            return data;
          },
        );

        const suggestionsData = suggestionRes.data || [];
        setSuggestions(suggestionsData);
        setShowDropdown(suggestionsData.length > 0);
        setHighlightedIndex(suggestionsData.length > 0 ? 0 : -1);
      } catch (error) {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSuggesting(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearch, isTypingNumber]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showDropdown || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
            handleSuggestionClick(suggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          setShowDropdown(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDropdown, suggestions, highlightedIndex]);

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setValue("search", suggestion.name, { shouldValidate: true });
    setShowDropdown(false);
    handleSubmit(onSearch)();
    inputRef.current?.blur();
  };

  // Handle form submission
  const onSubmit = (data) => {
    setShowDropdown(false);

    // Final validation on submit
    const trimmedSearch = data.search.trim();
    const isNumber = /^[0-9]{10,11}$/.test(trimmedSearch);
    const isName = /^[a-zA-Z\s]{2,50}$/.test(trimmedSearch);

    if (!isNumber && !isName) {
      toast.error(
        "❌ Please enter a valid 10-11 digit mobile number or patient name",
      );
      return;
    }

    onSearch(data);
  };

  // Format mobile number for display
  const formatMobile = (mobile) => {
    if (!mobile) return "No mobile";
    const cleaned = mobile.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return cleaned;
  };

  // Check if input is a valid search query
  const isValidSearch = (input) => {
    if (!input.trim()) return false;

    const trimmed = input.trim();
    const isNumber = /^[0-9]{10,11}$/.test(trimmed);
    const isName = /^[a-zA-Z\s]{2,50}$/.test(trimmed);

    return isNumber || isName;
  };

  return (
    <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl text-white shadow-md">
          <span className="text-xl">🔍</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Patient Lookup</h3>
          <p className="text-sm text-gray-600 mt-1">
            Search existing patient records by mobile number or name
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <span>📱</span>
            Mobile Number or Name <span className="text-red-500">*</span>
          </label>

          <div className="relative" ref={dropdownRef}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  {...register("search")}
                  placeholder="03001234567 or Patient Name"
                  className={`w-full rounded-xl border-2 p-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all pr-12 ${
                    errors.search
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  onFocus={() =>
                    !isTypingNumber && setShowDropdown(suggestions.length > 0)
                  }
                  autoComplete="off"
                  ref={(e) => {
                    register("search").ref(e);
                    inputRef.current = e;
                  }}
                  onChange={(e) => {
                    register("search").onChange(e);
                    if (!isTypingNumber) {
                      setShowDropdown(true);
                    }
                  }}
                />

                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {isSuggesting ? (
                    <div className="relative">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    searchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setValue("search", "", { shouldValidate: true });
                          setSuggestions([]);
                          setShowDropdown(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors text-lg"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isSearching || isSuggesting || !isValidSearch(searchInput)
                }
                className="px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
              >
                {isSearching ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    Searching...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👤</span>
                    Find Patient
                  </div>
                )}
              </button>
            </div>

            <AnimatePresence>
              {showDropdown &&
                !isTypingNumber &&
                (isSuggesting || suggestions.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    {isSuggesting ? (
                      <div className="p-6 flex flex-col items-center justify-center gap-4">
                        {/* Enhanced Loading Animation */}
                        <div className="relative">
                          {/* Outer pulsing ring */}
                          <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
                          {/* Rotating gradient ring */}
                          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-500 border-r-blue-400 rounded-full animate-spin-slow"></div>
                          {/* Pulsing center dot */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-gray-700 font-medium">
                            Searching Patients
                          </p>
                          <p className="text-gray-500 text-sm mt-1">
                            Looking for matching records...
                          </p>
                        </div>

                        {/* Animated dots */}
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          ></div>
                        </div>
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-4 text-gray-500 text-center flex flex-col items-center gap-2">
                        <span className="text-2xl">😕</span>
                        <p>No matching patients found</p>
                        <p className="text-sm text-gray-400">
                          Try typing a different name
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto">
                        <div className="p-3 bg-gray-50 border-b border-gray-200">
                          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            Found {suggestions.length} patient
                            {suggestions.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <ul>
                          {suggestions.map((suggestion, index) => (
                            <motion.li
                              key={`${suggestion.id || index}-${suggestion.name}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              whileHover={{ backgroundColor: "#f0f9ff" }}
                              className={`p-4 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                                highlightedIndex === index ? "bg-blue-50" : ""
                              }`}
                              onClick={() => handleSuggestionClick(suggestion)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-blue-600 text-lg">
                                    {suggestion.gender === "Female"
                                      ? "👩"
                                      : suggestion.gender === "Male"
                                        ? "👨"
                                        : "👤"}
                                  </span>
                                  <div>
                                    <div className="font-semibold text-gray-800">
                                      {suggestion.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Age: {suggestion.age || "N/A"} •{" "}
                                      {suggestion.gender || "Not specified"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-700">
                                    {formatMobile(suggestion.mobile)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Click to select →
                                  </div>
                                </div>
                              </div>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>

        {/* Validation Errors - Only show on blur */}
        {errors.search && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <span className="text-red-600 text-xl">⚠️</span>
            <div>
              <p className="text-red-700 font-medium">Invalid Input</p>
              <p className="text-red-600 text-sm mt-1">
                {errors.search.message}
              </p>
            </div>
          </motion.div>
        )}

        {/* Input Type Indicator */}
        {searchInput.trim() && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              {isTypingNumber
                ? "📱 Mobile number detected"
                : "👤 Name detected"}
            </span>
            {isTypingNumber && searchInput.trim().length < 10 && (
              <span className="text-amber-600">
                ({10 - searchInput.trim().length} more digits needed)
              </span>
            )}
          </div>
        )}

        {/* Search Tips */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600">💡</span>
            <p className="text-sm font-medium text-blue-800">Search Tips:</p>
          </div>
          <ul className="text-sm text-blue-700 space-y-1">
            <li className="flex items-center gap-2">
              <span>📱</span>
              Enter 10-11 digit mobile number (e.g., 03001234567)
            </li>
            <li className="flex items-center gap-2">
              <span>👤</span>
              Type at least 2 letters of the patient's name for suggestions
            </li>
            <li className="flex items-center gap-2">
              <span>🔤</span>
              Suggestions only appear when typing names (not numbers)
            </li>
            <li className="flex items-center gap-2">
              <span>⬆️⬇️</span>
              Use arrow keys to navigate suggestions, Enter to select
            </li>
          </ul>
        </div>
      </form>

      {/* Enhanced Loading Overlay */}
      {isSearching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center z-40"
        >
          <div className="text-center max-w-md p-8">
            {/* Multi-layered spinner */}
            <div className="relative mx-auto mb-6">
              {/* Outer static ring */}
              <div className="w-20 h-20 border-4 border-blue-100 rounded-full"></div>

              {/* Rotating ring with gradient */}
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-blue-500 border-r-blue-400 rounded-full animate-spin-slow"></div>

              {/* Inner rotating ring */}
              <div className="absolute top-2 left-2 right-2 bottom-2 border-4 border-transparent border-b-indigo-500 border-l-indigo-400 rounded-full animate-spin-slow-reverse"></div>

              {/* Pulsing center */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse"></div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Searching Patient Database
            </h3>
            <p className="text-gray-600 mb-6">
              Please wait while we find matching records...
            </p>

            {/* Animated progress dots */}
            <div className="flex justify-center gap-2 mb-4">
              <div
                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "200ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "400ms" }}
              ></div>
            </div>

            {/* Simulated progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                initial={{ width: "10%" }}
                animate={{ width: ["10%", "90%", "10%"] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <span className="text-blue-500">🔍</span>
              <span>Searching in progress...</span>
            </div>
          </div>
        </motion.div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-slow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-slow-reverse {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(-360deg);
          }
        }
        @keyframes bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 4s linear infinite;
        }
        .animate-bounce {
          animation: bounce 1.5s infinite ease-in-out;
        }
        .animate-pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default PatientSearchForm;
