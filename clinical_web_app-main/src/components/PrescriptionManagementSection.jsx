import React, { useState, useEffect } from "react";
import axios from "../utils/axiosClient";
import { toast } from "react-toastify";
import CreatableSelect from "react-select/creatable";
import Select from "react-select";
import { AiOutlineCloseCircle, AiOutlinePlus } from "react-icons/ai";
import Loader from "../pages/Loader";

const BASE_URL = "";

const getDefaultsForForm = (form) => {
  const f = (form || "Tablet").toLowerCase();
  if (f.includes("tablet")) {
    return { dosage_en: "1", dosage_urdu: "ایک گولی", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
  }
  if (f.includes("capsule")) {
    return { dosage_en: "1", dosage_urdu: "ایک گولی", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
  }
  if (["syrup", "liquid", "suspension", "elixir"].some((t) => f.includes(t))) {
    return { dosage_en: "one_spoon", dosage_urdu: "ایک چمچ", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
  }
  if (["injection", "injectable", "iv", "im"].some((t) => f.includes(t))) {
    return { dosage_en: "one_injection", dosage_urdu: "ایک ٹیکہ", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
  }
  if (["sachet", "powder", "granules"].some((t) => f.includes(t))) {
    return { dosage_en: "one_sachet", dosage_urdu: "ایک ساشے", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
  }
  if (f.includes("drop")) {
    return { dosage_en: "two_droplets", dosage_urdu: "دو قطرے", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
  }
  return { dosage_en: "1", dosage_urdu: "ایک گولی", frequency_en: "morning", frequency_urdu: "صبح", duration_en: "7_days", duration_urdu: "1 ہفتہ (7 دن)", instructions_en: "after_meal", instructions_urdu: "کھانے کے بعد" };
};

// Keep backward compat alias used in handleAddCourse / handleAddMedicine
const MEDICINE_DEFAULTS = { Tablet: getDefaultsForForm("Tablet") };

// Duration options shown for Course 2+ of the same medicine (start-after intervals)
const AFTER_COURSE_DURATION_OPTIONS = [
  { value: "after_1_week", label: "1 ہفتہ بعد" },
  { value: "after_2_weeks", label: "2 ہفتے بعد" },
  { value: "after_3_weeks", label: "3 ہفتے بعد" },
  { value: "after_1_month", label: "1 مہینہ بعد" },
  { value: "after_6_weeks", label: "6 ہفتے بعد" },
  { value: "after_2_months", label: "2 مہینے بعد" },
  { value: "after_10_weeks", label: "10 ہفتے بعد" },
  { value: "after_3_months", label: "3 مہینے بعد" },
  { value: "after_4_months", label: "4 مہینے بعد" },
  { value: "after_6_months", label: "6 مہینے بعد" },
  { value: "after_9_months", label: "9 مہینے بعد" },
  { value: "after_1_year", label: "1 سال بعد" },
  { value: "after_finishing_course", label: "کورس ختم کرنے کے بعد" },
];

const PrescriptionManagementSection = ({
  selectedMedicines = [],
  setSelectedMedicines,
  customSelectStyles,
  medicines,
  refreshMedicines,
}) => {
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (medicines.length === 0) {
      toast.warn("No medicines available. Please create a new medicine.");
    }
  }, [medicines]);

  const handleCreateMedicine = async (inputValue) => {
    if (!inputValue.trim()) {
      toast.error("Medicine name cannot be empty");
      return null;
    }
    setIsCreating(true);
    try {
      const response = await axios.post(
        `${BASE_URL}/api/medicines`,
        {
          medicine_name: inputValue,
          generic_name: "",
          urdu_name: "",
          urdu_form: "",
          urdu_strength: "",
          form: "Tablet",
          brand_name: inputValue,
        },
        {
          timeout: 10000,
        },
      );
      const newMedicine = response.data;
      if (!newMedicine.id) {
        throw new Error("Server did not return a valid medicine ID");
      }
      // No verify GET needed — the POST response already confirms the medicine was saved.
      // Refresh Redux store so the new medicine appears in the dropdown.
      await refreshMedicines();
      toast.success(`Medicine "${inputValue}" created`);
      return String(newMedicine.id);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create medicine");
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddMedicine = async (inputValue = null) => {
    let newId = null;
    if (inputValue) {
      newId = await handleCreateMedicine(inputValue);
      if (!newId) return;
    }
    setSelectedMedicines((prev) => [
      ...prev,
      {
        medicine_id: newId || "",
        form: "Tablet",
        dosage_en: MEDICINE_DEFAULTS.Tablet.dosage_en,
        dosage_urdu: MEDICINE_DEFAULTS.Tablet.dosage_urdu,
        frequency_en: MEDICINE_DEFAULTS.Tablet.frequency_en,
        frequency_urdu: MEDICINE_DEFAULTS.Tablet.frequency_urdu,
        duration_en: MEDICINE_DEFAULTS.Tablet.duration_en,
        duration_urdu: MEDICINE_DEFAULTS.Tablet.duration_urdu,
        instructions_en: MEDICINE_DEFAULTS.Tablet.instructions_en,
        instructions_urdu: MEDICINE_DEFAULTS.Tablet.instructions_urdu,
      },
    ]);
  };

  const handleAddCourse = (index, med) => {
    const formDefaults = getDefaultsForForm(med.form);
    setSelectedMedicines((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, {
        medicine_id: med.medicine_id,
        form: med.form || "Tablet",
        dosage_en: formDefaults.dosage_en,
        dosage_urdu: formDefaults.dosage_urdu,
        frequency_en: formDefaults.frequency_en,
        frequency_urdu: formDefaults.frequency_urdu,
        duration_en: "after_1_week",
        duration_urdu: "1 ہفتہ بعد",
        instructions_en: formDefaults.instructions_en,
        instructions_urdu: formDefaults.instructions_urdu,
      });
      return next;
    });
  };

  const validateMedicines = () => {
    if (selectedMedicines.length === 0) return true;
    const invalid = selectedMedicines.some((med, index) => {
      if (!med.medicine_id || med.medicine_id === "") {
        return true;
      }
      if (!medicines.some((m) => m.value === String(med.medicine_id))) {
        return true;
      }
      return false;
    });
    if (invalid) {
      toast.error(
        "Some medicines are invalid or not recognized. Please select valid medicines or remove entries.",
      );
      return false;
    }
    return true;
  };

  // Modified to allow selecting the same medicine multiple times
  const getAvailableMedicines = () => {
    return medicines; // Return all medicines without filtering
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-purple-600 p-2 rounded-lg text-white">💊</div>
        <h3 className="text-lg font-semibold text-gray-800">
          Prescription Management
        </h3>
      </div>

      {/* Optional: Add note for user clarity */}
      <p className="text-sm text-gray-500 mb-2">
        You can select the same medicine multiple times with different dosages
        or instructions.
      </p>

      {medicines.length === 0 && !isCreating ? (
        <div className="text-center text-gray-600">
          <p>No medicines available. Create a new medicine to proceed.</p>
          <CreatableSelect
            isLoading={isCreating}
            loadingMessage={() => "Creating medicine..."}
            options={[]}
            value={null}
            onCreateOption={(inputValue) => handleAddMedicine(inputValue)}
            placeholder="Type to create a new medicine..."
            isClearable
            styles={customSelectStyles}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {selectedMedicines.map((med, index) => {
            const courseNum = selectedMedicines
              .slice(0, index)
              .filter((m) => String(m.medicine_id) === String(med.medicine_id) && m.medicine_id)
              .length + 1;
            const totalCourses = selectedMedicines.filter(
              (m) => String(m.medicine_id) === String(med.medicine_id) && m.medicine_id
            ).length;
            const isMultiCourse = totalCourses > 1;
            return (
            <div key={index} className={`flex items-center gap-3 ${isMultiCourse ? "pl-3 border-l-4 border-indigo-300" : ""}`}>
              {isMultiCourse && (
                <div className="flex-none self-start mt-6">
                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    Course {courseNum}
                  </span>
                </div>
              )}
              <div className="flex-1 grid grid-cols-5 gap-3">
                {/* Medicine Selection */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">
                    Medicine
                  </label>
                  <CreatableSelect
                    isLoading={isCreating}
                    loadingMessage={() => "Creating medicine..."}
                    options={getAvailableMedicines()} // Updated to use new function
                    value={
                      med.medicine_id
                        ? medicines.find(
                            (m) => m.value === String(med.medicine_id),
                          ) || {
                            value: med.medicine_id,
                            label: `Unknown (${med.medicine_id})`,
                          }
                        : null
                    }
                    onCreateOption={async (inputValue) => {
                      const newId = await handleCreateMedicine(inputValue);
                      if (newId) {
                        setSelectedMedicines((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, medicine_id: newId }
                              : item,
                          ),
                        );
                      }
                    }}
                    onChange={(selectedOption) => {
                      const newId = selectedOption ? selectedOption.value : "";
                      if (newId && !medicines.some((m) => m.value === newId)) {
                        toast.warn(
                          `Medicine ID ${newId} is not recognized. Please create or select a valid medicine.`,
                        );
                        return;
                      }
                      const form = selectedOption?.raw?.form;
                      const defaults = selectedOption ? getDefaultsForForm(form) : {};
                      setSelectedMedicines((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, medicine_id: newId, ...defaults }
                            : item,
                        ),
                      );
                    }}
                    placeholder="Select or create medicine..."
                    isClearable
                    styles={customSelectStyles}
                  />
                </div>

                {/* Frequency */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">
                    Frequency
                  </label>
                  <Select
                    options={[
                      { value: "morning", label: "صبح" },
                      { value: "afternoon", label: "دوپہر" },
                      { value: "evening", label: "شام" },
                      { value: "night", label: "رات" },
                      { value: "morning_evening", label: "صبح، شام" },
                      { value: "morning_night", label: "صبح، رات" },
                      { value: "afternoon_evening", label: "دوپہر، شام" },
                      { value: "afternoon_night", label: "دوپہر، رات" },
                      {
                        value: "morning_evening_night",
                        label: "صبح، شام، رات",
                      },
                      {
                        value: "morning_afternoon_evening",
                        label: "صبح، دوپہر، شام",
                      },
                      { value: "as_needed", label: "حسب ضرورت" },
                      {
                        value: "morning_afternoon_night",
                        label: "صبح، دوپہر، رات",
                      },
                      {
                        value: "afternoon_evening_night",
                        label: "دوپہر، شام، رات",
                      },
                      { value: "early_morning", label: "صبح سویرے" },
                      { value: "late_morning", label: "دیر صبح" },
                      { value: "late_afternoon", label: "دیر دوپہر" },
                      { value: "sunset", label: "غروب آفتاب" },
                      { value: "midnight", label: "آدھی رات" },
                      { value: "late_night", label: "رات دیر گئے" },
                      { value: "morning_afternoon", label: "صبح، دوپہر" },
                      { value: "evening_night", label: "شام، رات" },
                      { value: "early_morning_night", label: "صبح سویرے، رات" },
                      {
                        value: "morning_late_afternoon",
                        label: "صبح، دیر دوپہر",
                      },
                      { value: "afternoon_sunset", label: "دوپہر، غروب آفتاب" },
                      { value: "all_day", label: "پورا دن" },
                      { value: "all_night", label: "پوری رات" },
                      { value: "24_hours", label: "چوبیس گھنٹے" },

                      // New time-based frequency options
                      { value: "weekly", label: "ہفتے میں ایک بار" },
                      { value: "biweekly", label: "دو ہفتے بعد" },
                      { value: "monthly", label: "مہینے میں ایک بار" },
                      { value: "bimonthly", label: "دو مہینے بعد" },
                      { value: "quarterly", label: "تین مہینے بعد" },
                      { value: "half_yearly", label: "چھ مہینے بعد" },
                      { value: "yearly", label: "سال میں ایک بار" },
                      { value: "once_week", label: "ایک ہفتے بعد" },
                      { value: "two_weeks", label: "دو ہفتوں بعد" },
                      { value: "three_weeks", label: "تین ہفتوں بعد" },
                      { value: "four_weeks", label: "چار ہفتوں بعد" },
                      { value: "six_weeks", label: "چھ ہفتوں بعد" },
                      { value: "eight_weeks", label: "آٹھ ہفتوں بعد" },
                      { value: "twelve_weeks", label: "بارہ ہفتوں بعد" },
                      { value: "once_month", label: "ایک مہینے بعد" },
                      { value: "two_months", label: "دو مہینوں بعد" },
                      { value: "three_months", label: "تین مہینوں بعد" },
                      { value: "four_months", label: "چار مہینوں بعد" },
                      { value: "six_months", label: "چھ مہینوں بعد" },
                      { value: "nine_months", label: "نو مہینوں بعد" },
                      { value: "every_other_day", label: "ایک دن چھوڑ کر" },
                      { value: "twice_week", label: "ہفتے میں دو بار" },
                      { value: "thrice_week", label: "ہفتے میں تین بار" },
                      { value: "four_times_week", label: "ہفتے میں چار بار" },
                      { value: "five_times_week", label: "ہفتے میں پانچ بار" },
                      { value: "six_times_week", label: "ہفتے میں چھ بار" },
                      { value: "alternate_days", label: "متبادل دنوں میں" },
                      { value: "once_two_days", label: "دو دن بعد" },
                      { value: "once_three_days", label: "تین دن بعد" },
                      { value: "once_four_days", label: "چار دن بعد" },
                      { value: "once_five_days", label: "پانچ دن بعد" },
                      { value: "once_six_days", label: "چھ دن بعد" },
                    ]}
                    value={
                      med.frequency_en
                        ? {
                            value: med.frequency_en,
                            label: med.frequency_urdu,
                          }
                        : null
                    }
                    onChange={(option) => {
                      setSelectedMedicines((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                frequency_en: option ? option.value : "",
                                frequency_urdu: option ? option.label : "",
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder="Select frequency..."
                    isClearable
                    styles={customSelectStyles}
                    className="font-urdu"
                  />
                </div>

                {/* Dosage */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">
                    Dosage
                  </label>
                  <Select
                    options={[
                      // Your existing options remain unchanged...
                      // Tablet options (complete fractional sequence)
                      { value: "0.25", label: "ایک چوتھائی گولی" },
                      { value: "0.33", label: "ایک تہائی گولی" },
                      { value: "0.5", label: "آدھی گولی" },
                      { value: "0.66", label: "دو تہائی گولی" },
                      { value: "0.75", label: "تین چوتھائی گولی" },
                      { value: "1", label: "ایک گولی" },
                      { value: "1.25", label: "سوا ایک گولی" },
                      { value: "1.33", label: "ایک اور تہائی گولی" },
                      { value: "1.5", label: "ڈیڑھ گولی" },
                      { value: "1.66", label: "ایک اور دو تہائی گولی" },
                      { value: "1.75", label: "ایک اور تین چوتھائی گولی" },
                      { value: "2", label: "دو گولیاں" },
                      { value: "2.25", label: "سوا دو گولیاں" },
                      { value: "2.33", label: "دو اور ایک تہائی گولیاں" },
                      { value: "2.5", label: "ڈھائی گولیاں" },
                      { value: "2.66", label: "دو اور دو تہائی گولیاں" },
                      { value: "2.75", label: "دو اور تین چوتھائی گولیاں" },
                      { value: "3", label: "تین گولیاں" },
                      { value: "3.25", label: "سوا تین گولیاں" },
                      { value: "3.33", label: "تین اور ایک تہائی گولیاں" },
                      { value: "3.5", label: "ساڑھے تین گولیاں" },
                      { value: "3.66", label: "تین اور دو تہائی گولیاں" },
                      { value: "3.75", label: "تین اور تین چوتھائی گولیاں" },
                      { value: "4", label: "چار گولیاں" },
                      { value: "4.25", label: "سوا چار گولیاں" },
                      { value: "4.33", label: "چار اور ایک تہائی گولیاں" },
                      { value: "4.5", label: "ساڑھے چار گولیاں" },
                      { value: "4.66", label: "چار اور دو تہائی گولیاں" },
                      { value: "4.75", label: "چار اور تین چوتھائی گولیاں" },
                      { value: "5", label: "پانچ گولیاں" },
                      { value: "5.25", label: "سوا پانچ گولیاں" },
                      { value: "5.33", label: "پانچ اور ایک تہائی گولیاں" },
                      { value: "5.5", label: "ساڑھے پانچ گولیاں" },
                      { value: "5.66", label: "پانچ اور دو تہائی گولیاں" },
                      { value: "5.75", label: "پانچ اور تین چوتھائی گولیاں" },
                      { value: "6", label: "چھ گولیاں" },
                      { value: "6.25", label: "سوا چھ گولیاں" },
                      { value: "6.33", label: "چھ اور ایک تہائی گولیاں" },
                      { value: "6.5", label: "ساڑھے چھ گولیاں" },
                      { value: "6.66", label: "چھ اور دو تہائی گولیاں" },
                      { value: "6.75", label: "چھ اور تین چوتھائی گولیاں" },
                      { value: "7", label: "سات گولیاں" },
                      { value: "7.25", label: "سوا سات گولیاں" },
                      { value: "7.33", label: "سات اور ایک تہائی گولیاں" },
                      { value: "7.5", label: "ساڑھے سات گولیاں" },
                      { value: "7.66", label: "سات اور دو تہائی گولیاں" },
                      { value: "7.75", label: "سات اور تین چوتھائی گولیاں" },
                      { value: "8", label: "آٹھ گولیاں" },
                      { value: "8.5", label: "ساڑھے آٹھ گولیاں" },
                      { value: "9", label: "نو گولیاں" },
                      { value: "9.5", label: "ساڑھے نو گولیاں" },
                      { value: "10", label: "دس گولیاں" },
                      { value: "11", label: "گیارہ گولیاں" },
                      { value: "12", label: "بارہ گولیاں" },
                      { value: "13", label: "تیرہ گولیاں" },
                      { value: "14", label: "چودہ گولیاں" },
                      { value: "15", label: "پندرہ گولیاں" },

                      // Spoon measurements (complete set)
                      { value: "quarter_spoon", label: "چوتھائی چمچ" },
                      { value: "third_spoon", label: "تہائی چمچ" },
                      { value: "half_spoon", label: "آدھا چمچ" },
                      { value: "two_thirds_spoon", label: "دو تہائی چمچ" },
                      {
                        value: "three_quarters_spoon",
                        label: "تین چوتھائی چمچ",
                      },
                      { value: "one_spoon", label: "ایک چمچ" },
                      { value: "one_and_quarter_spoons", label: "سوا ایک چمچ" },
                      {
                        value: "one_and_third_spoons",
                        label: "ایک اور تہائی چمچ",
                      },
                      { value: "one_and_half_spoon", label: "ڈیڑھ چمچ" },
                      {
                        value: "one_and_two_thirds_spoons",
                        label: "ایک اور دو تہائی چمچ",
                      },
                      {
                        value: "one_and_three_quarters_spoons",
                        label: "ایک اور تین چوتھائی چمچ",
                      },
                      { value: "two_spoons", label: "دو چمچ" },
                      { value: "two_and_half_spoons", label: "ڈھائی چمچ" },
                      { value: "three_spoons", label: "تین چمچ" },
                      {
                        value: "three_and_half_spoons",
                        label: "ساڑھے تین چمچ",
                      },
                      { value: "four_spoons", label: "چار چمچ" },
                      { value: "five_spoons", label: "پانچ چمچ" },

                      // ML measurements (complete sequence)
                      { value: "0.5_ml", label: "آدھا ملی لیٹر" },
                      { value: "1_ml", label: "ایک ملی لیٹر" },
                      { value: "1.5_ml", label: "ڈیڑھ ملی لیٹر" },
                      { value: "2_ml", label: "دو ملی لیٹر" },
                      { value: "2.5_ml", label: "ڈھائی ملی لیٹر" },
                      { value: "3_ml", label: "تین ملی لیٹر" },
                      { value: "3.5_ml", label: "ساڑھے تین ملی لیٹر" },
                      { value: "4_ml", label: "چار ملی لیٹر" },
                      { value: "4.5_ml", label: "ساڑھے چار ملی لیٹر" },
                      { value: "5_ml", label: "پانچ ملی لیٹر" },
                      { value: "5.5_ml", label: "ساڑھے پانچ ملی لیٹر" },
                      { value: "6_ml", label: "چھ ملی لیٹر" },
                      { value: "6.5_ml", label: "ساڑھے چھ ملی لیٹر" },
                      { value: "7_ml", label: "سات ملی لیٹر" },
                      { value: "7.5_ml", label: "ساڑھے سات ملی لیٹر" },
                      { value: "8_ml", label: "آٹھ ملی لیٹر" },
                      { value: "8.5_ml", label: "ساڑھے آٹھ ملی لیٹر" },
                      { value: "9_ml", label: "نو ملی لیٹر" },
                      { value: "9.5_ml", label: "ساڑھے نو ملی لیٹر" },
                      { value: "10_ml", label: "دس ملی لیٹر" },
                      { value: "12.5_ml", label: "ساڑھے بارہ ملی لیٹر" },
                      { value: "15_ml", label: "پندرہ ملی لیٹر" },
                      { value: "20_ml", label: "بیس ملی لیٹر" },
                      { value: "25_ml", label: "پچیس ملی لیٹر" },
                      { value: "30_ml", label: "تیس ملی لیٹر" },
                      { value: "40_ml", label: "چالیس ملی لیٹر" },
                      { value: "50_ml", label: "پچاس ملی لیٹر" },
                      { value: "60_ml", label: "ساٹھ ملی لیٹر" },
                      { value: "75_ml", label: "پچھتر ملی لیٹر" },
                      { value: "100_ml", label: "سو ملی لیٹر" },
                      { value: "125_ml", label: "سو پچیس ملی لیٹر" },
                      { value: "150_ml", label: "سو پچاس ملی لیٹر" },
                      { value: "200_ml", label: "دو سو ملی لیٹر" },

                      // Droplets (complete set)
                      { value: "one_droplet", label: "ایک قطرہ" },
                      { value: "two_droplets", label: "دو قطرے" },
                      { value: "three_droplets", label: "تین قطرے" },
                      { value: "four_droplets", label: "چار قطرے" },
                      { value: "five_droplets", label: "پانچ قطرے" },
                      { value: "six_droplets", label: "چھ قطرے" },
                      { value: "seven_droplets", label: "سات قطرے" },
                      { value: "eight_droplets", label: "آٹھ قطرے" },
                      { value: "nine_droplets", label: "نو قطرے" },
                      { value: "ten_droplets", label: "دس قطرے" },
                      { value: "twelve_droplets", label: "بارہ قطرے" },
                      { value: "fifteen_droplets", label: "پندرہ قطرے" },
                      { value: "twenty_droplets", label: "بیس قطرے" },

                      // Injections (complete set)
                      { value: "quarter_injection", label: "چوتھائی ٹیکہ" },
                      { value: "third_injection", label: "تہائی ٹیکہ" },
                      { value: "half_injection", label: "آدھا ٹیکہ" },
                      { value: "two_thirds_injection", label: "دو تہائی ٹیکہ" },
                      {
                        value: "three_quarters_injection",
                        label: "تین چوتھائی ٹیکہ",
                      },
                      { value: "one_injection", label: "ایک ٹیکہ" },
                      {
                        value: "one_and_quarter_injections",
                        label: "سوا ایک ٹیکہ",
                      },
                      {
                        value: "one_and_third_injections",
                        label: "ایک اور تہائی ٹیکہ",
                      },
                      { value: "one_and_half_injection", label: "ڈیڑھ ٹیکہ" },
                      {
                        value: "one_and_two_thirds_injections",
                        label: "ایک اور دو تہائی ٹیکہ",
                      },
                      {
                        value: "one_and_three_quarters_injections",
                        label: "ایک اور تین چوتھائی ٹیکہ",
                      },
                      { value: "two_injections", label: "دو ٹیکے" },
                      { value: "two_and_half_injections", label: "ڈھائی ٹیکے" },
                      { value: "three_injections", label: "تین ٹیکے" },
                      {
                        value: "three_and_half_injections",
                        label: "ساڑھے تین ٹیکے",
                      },
                      { value: "four_injections", label: "چار ٹیکے" },
                      { value: "five_injections", label: "پانچ ٹیکے" },

                      // Sachets (complete set)
                      { value: "quarter_sachet", label: "چوتھائی ساشے" },
                      { value: "third_sachet", label: "تہائی ساشے" },
                      { value: "half_sachet", label: "آدھا ساشے" },
                      { value: "two_thirds_sachet", label: "دو تہائی ساشے" },
                      {
                        value: "three_quarters_sachet",
                        label: "تین چوتھائی ساشے",
                      },
                      { value: "one_sachet", label: "ایک ساشے" },
                      {
                        value: "one_and_quarter_sachets",
                        label: "سوا ایک ساشے",
                      },
                      {
                        value: "one_and_third_sachets",
                        label: "ایک اور تہائی ساشے",
                      },
                      { value: "one_and_half_sachet", label: "ڈیڑھ ساشے" },
                      {
                        value: "one_and_two_thirds_sachets",
                        label: "ایک اور دو تہائی ساشے",
                      },
                      {
                        value: "one_and_three_quarters_sachets",
                        label: "ایک اور تین چوتھائی ساشے",
                      },
                      { value: "two_sachets", label: "دو ساشے" },
                      { value: "two_and_half_sachets", label: "ڈھائی ساشے" },
                      { value: "three_sachets", label: "تین ساشے" },
                      {
                        value: "three_and_half_sachets",
                        label: "ساڑھے تین ساشے",
                      },
                      { value: "four_sachets", label: "چار ساشے" },
                      { value: "five_sachets", label: "پانچ ساشے" },

                      // Special cases
                      { value: "headache_mild", label: "ہلکے سر درد کے لیے" },
                      {
                        value: "headache_moderate",
                        label: "معتدل سر درد کے لیے",
                      },
                      { value: "headache_severe", label: "شدید سر درد کے لیے" },
                      { value: "pain_mild", label: "ہلکے درد کے لیے" },
                      { value: "pain_moderate", label: "معتدل درد کے لیے" },
                      { value: "pain_severe", label: "شدید درد کے لیے" },
                      { value: "as_needed", label: "ضرورت کے مطابق" },
                      { value: "before_meal", label: "کھانے سے پہلے" },
                      { value: "after_meal", label: "کھانے کے بعد" },
                      { value: "with_meal", label: "کھانے کے ساتھ" },
                      { value: "empty_stomach", label: "خالی پیٹ" },
                      { value: "at_bedtime", label: "سونے سے پہلے" },

                      // Frequencies (complete set)
                      { value: "every_2_hours", label: "ہر 2 گھنٹے بعد" },
                      { value: "every_3_hours", label: "ہر 3 گھنٹے بعد" },
                      { value: "every_4_hours", label: "ہر 4 گھنٹے بعد" },
                      { value: "every_5_hours", label: "ہر 5 گھنٹے بعد" },
                      { value: "every_6_hours", label: "ہر 6 گھنٹے بعد" },
                      { value: "every_8_hours", label: "ہر 8 گھنٹے بعد" },
                      { value: "every_12_hours", label: "ہر 12 گھنٹے بعد" },
                      { value: "once_a_day", label: "دن میں ایک بار" },
                      { value: "twice_a_day", label: "دن میں دو بار" },
                      { value: "three_times_a_day", label: "دن میں تین بار" },
                      { value: "four_times_a_day", label: "دن میں چار بار" },
                      { value: "five_times_a_day", label: "دن میں پانچ بار" },
                      { value: "every_other_day", label: "ایک دن چھوڑ کر" },
                      { value: "twice_a_week", label: "ہفتے میں دو بار" },
                      { value: "thrice_a_week", label: "ہفتے میں تین بار" },
                      { value: "once_a_week", label: "ہفتے میں ایک بار" },
                      { value: "once_a_month", label: "مہینے میں ایک بار" },
                      {
                        value: "as_directed",
                        label: "ڈاکٹر کے مشورے کے مطابق",
                      },

                      {
                        value: "every_hour_one_tab",
                        label: "ہر گھنٹے ایک گولی",
                      },
                      {
                        value: "every_2_hours_one_tab",
                        label: "ہر 2 گھنٹے بعد ایک گولی",
                      },
                      {
                        value: "every_3_hours_one_tab",
                        label: "ہر 3 گھنٹے بعد ایک گولی",
                      },
                      {
                        value: "every_4_hours_one_tab",
                        label: "ہر 4 گھنٹے بعد ایک گولی",
                      },
                      {
                        value: "every_6_hours_one_tab",
                        label: "ہر 6 گھنٹے بعد ایک گولی",
                      },
                      {
                        value: "every_8_hours_one_tab",
                        label: "ہر 8 گھنٹے بعد ایک گولی",
                      },
                      {
                        value: "every_12_hours_one_tab",
                        label: "ہر 12 گھنٹے بعد ایک گولی",
                      },
                      {
                        value: "every_hour_half_tab",
                        label: "ہر گھنٹے آدھی گولی",
                      },
                      {
                        value: "every_2_hours_half_tab",
                        label: "ہر 2 گھنٹے بعد آدھی گولی",
                      },
                      {
                        value: "every_4_hours_half_tab",
                        label: "ہر 4 گھنٹے بعد آدھی گولی",
                      },
                      {
                        value: "every_6_hours_half_tab",
                        label: "ہر 6 گھنٹے بعد آدھی گولی",
                      },
                      {
                        value: "every_hour_2_tabs",
                        label: "ہر گھنٹے دو گولیاں",
                      },
                      {
                        value: "every_2_hours_2_tabs",
                        label: "ہر 2 گھنٹے بعد دو گولیاں",
                      },
                      {
                        value: "every_4_hours_2_tabs",
                        label: "ہر 4 گھنٹے بعد دو گولیاں",
                      },
                      {
                        value: "every_6_hours_2_tabs",
                        label: "ہر 6 گھنٹے بعد دو گولیاں",
                      },
                      { value: "morning_only", label: "صرف صبح" },
                      { value: "evening_only", label: "صرف شام" },
                      { value: "night_only", label: "صرف رات" },
                      {
                        value: "first_day_loading",
                        label: "پہلے دن لوڈنگ خوراک",
                      },
                      { value: "maintenance_dose", label: "مینٹیننس خوراک" },
                      { value: "initial_dose", label: "ابتدائی خوراک" },
                      { value: "titration_dose", label: "ٹائٹریشن خوراک" },
                      { value: "maximum_dose", label: "زیادہ سے زیادہ خوراک" },
                      { value: "minimum_dose", label: "کم سے کم خوراک" },
                      // ========== NEW ADDITIONS ==========
                      // ========== GEL APPLICATION FREQUENCY OPTIONS ADDED ==========
                      {
                        value: "gel_once_daily",
                        label: "دن میں ایک بار جیل لگائیں",
                      },
                      {
                        value: "gel_twice_daily",
                        label: "دن میں دو بار جیل لگائیں",
                      },
                      {
                        value: "gel_thrice_daily",
                        label: "دن میں تین بار جیل لگائیں",
                      },
                      {
                        value: "gel_four_times_daily",
                        label: "دن میں چار بار جیل لگائیں",
                      },
                      {
                        value: "gel_every_morning",
                        label: "ہر صبح جیل لگائیں",
                      },
                      {
                        value: "gel_every_evening",
                        label: "ہر شام جیل لگائیں",
                      },
                      { value: "gel_every_night", label: "ہر رات جیل لگائیں" },
                      {
                        value: "gel_morning_evening",
                        label: "صبح اور شام جیل لگائیں",
                      },
                      {
                        value: "gel_morning_night",
                        label: "صبح اور رات جیل لگائیں",
                      },
                      {
                        value: "gel_evening_night",
                        label: "شام اور رات جیل لگائیں",
                      },
                      {
                        value: "gel_every_2_hours",
                        label: "ہر 2 گھنٹے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_every_3_hours",
                        label: "ہر 3 گھنٹے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_every_4_hours",
                        label: "ہر 4 گھنٹے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_every_6_hours",
                        label: "ہر 6 گھنٹے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_every_8_hours",
                        label: "ہر 8 گھنٹے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_every_12_hours",
                        label: "ہر 12 گھنٹے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_after_bath",
                        label: "نہانے کے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_before_bed",
                        label: "سونے سے پہلے جیل لگائیں",
                      },
                      {
                        value: "gel_on_clean_skin",
                        label: "صاف جلد پر جیل لگائیں",
                      },
                      {
                        value: "gel_as_needed",
                        label: "ضرورت کے مطابق جیل لگائیں",
                      },
                      {
                        value: "gel_during_pain",
                        label: "درد ہونے پر جیل لگائیں",
                      },
                      {
                        value: "gel_after_exercise",
                        label: "ورزش کے بعد جیل لگائیں",
                      },
                      {
                        value: "gel_before_activity",
                        label: "سرگرمی سے پہلے جیل لگائیں",
                      },
                      // Syrup Measurements - Comprehensive set
                      {
                        value: "teaspoon_syrup",
                        label: "ایک چائے کا چمچ شربت",
                      },
                      {
                        value: "half_teaspoon_syrup",
                        label: "آدھا چائے کا چمچ شربت",
                      },
                      {
                        value: "quarter_teaspoon_syrup",
                        label: "چوتھائی چائے کا چمچ شربت",
                      },
                      {
                        value: "tablespoon_syrup",
                        label: "ایک کھانے کا چمچ شربت",
                      },
                      {
                        value: "half_tablespoon_syrup",
                        label: "آدھا کھانے کا چمچ شربت",
                      },
                      {
                        value: "two_teaspoons_syrup",
                        label: "دو چائے کے چمچ شربت",
                      },
                      {
                        value: "three_teaspoons_syrup",
                        label: "تین چائے کے چمچ شربت",
                      },
                      { value: "small_cup_syrup", label: "چھوٹا کپ شربت" },
                      { value: "medium_cup_syrup", label: "درمیانہ کپ شربت" },
                      { value: "large_cup_syrup", label: "بڑا کپ شربت" },
                      { value: "one_ounce_syrup", label: "ایک اونس شربت" },
                      { value: "two_ounces_syrup", label: "دو اونس شربت" },
                      { value: "quarter_cup_syrup", label: "چوتھائی کپ شربت" },
                      { value: "half_cup_syrup", label: "آدھا کپ شربت" },
                      { value: "full_cup_syrup", label: "ایک پورا کپ شربت" },

                      { value: "every_2_hours", label: "ہر 2 گھنٹے بعد" },
                      { value: "every_3_hours", label: "ہر 3 گھنٹے بعد" },
                      { value: "every_4_hours", label: "ہر 4 گھنٹے بعد" },
                      { value: "every_5_hours", label: "ہر 5 گھنٹے بعد" },
                      { value: "every_6_hours", label: "ہر 6 گھنٹے بعد" },
                      { value: "every_8_hours", label: "ہر 8 گھنٹے بعد" },
                      { value: "every_12_hours", label: "ہر 12 گھنٹے بعد" },
                      { value: "once_a_day", label: "دن میں ایک بار" },
                      { value: "twice_a_day", label: "دن میں دو بار" },
                      { value: "three_times_a_day", label: "دن میں تین بار" },
                      { value: "four_times_a_day", label: "دن میں چار بار" },
                      { value: "five_times_a_day", label: "دن میں پانچ بار" },
                      { value: "every_other_day", label: "ایک دن چھوڑ کر" },
                      { value: "twice_a_week", label: "ہفتے میں دو بار" },
                      { value: "thrice_a_week", label: "ہفتے میں تین بار" },
                      { value: "once_a_week", label: "ہفتے میں ایک بار" },
                      { value: "once_a_month", label: "مہینے میں ایک بار" },
                      {
                        value: "as_directed",
                        label: "ڈاکٹر کے مشورے کے مطابق",
                      },

                      // Weight-based dosages
                      { value: "per_kg_5mg", label: "فی کلوگرام 5 ملی گرام" },
                      { value: "per_kg_10mg", label: "فی کلوگرام 10 ملی گرام" },
                      { value: "per_kg_15mg", label: "فی کلوگرام 15 ملی گرام" },
                      { value: "per_kg_20mg", label: "فی کلوگرام 20 ملی گرام" },
                      { value: "per_kg_25mg", label: "فی کلوگرام 25 ملی گرام" },
                      { value: "per_kg_30mg", label: "فی کلوگرام 30 ملی گرام" },
                      { value: "per_kg_40mg", label: "فی کلوگرام 40 ملی گرام" },
                      { value: "per_kg_50mg", label: "فی کلوگرام 50 ملی گرام" },
                      { value: "per_kg_1mg", label: "فی کلوگرام 1 ملی گرام" },
                      { value: "per_kg_2mg", label: "فی کلوگرام 2 ملی گرام" },
                      { value: "per_kg_3mg", label: "فی کلوگرام 3 ملی گرام" },

                      // Surface area dosages
                      {
                        value: "per_sqm_10mg",
                        label: "فی مربع میٹر 10 ملی گرام",
                      },
                      {
                        value: "per_sqm_20mg",
                        label: "فی مربع میٹر 20 ملی گرام",
                      },
                      {
                        value: "per_sqm_30mg",
                        label: "فی مربع میٹر 30 ملی گرام",
                      },
                      {
                        value: "per_sqm_40mg",
                        label: "فی مربع میٹر 40 ملی گرام",
                      },
                      {
                        value: "per_sqm_50mg",
                        label: "فی مربع میٹر 50 ملی گرام",
                      },

                      // Age-based dosages
                      { value: "infant_dose", label: "شیر خوار بچے کی خوراک" },
                      { value: "toddler_dose", label: "چھوٹے بچے کی خوراک" },
                      { value: "child_dose", label: "بچے کی خوراک" },
                      { value: "adult_dose", label: "بالغ کی خوراک" },
                      { value: "elderly_dose", label: "بوڑھے کی خوراک" },
                      {
                        value: "neonatal_dose",
                        label: "نوزائیدہ بچے کی خوراک",
                      },

                      // Spray/Nasal/Aerosol dosages
                      { value: "one_spray", label: "ایک سپرے" },
                      { value: "two_sprays", label: "دو سپرے" },
                      { value: "three_sprays", label: "تین سپرے" },
                      { value: "one_puff", label: "ایک پف" },
                      { value: "two_puffs", label: "دو پف" },
                      { value: "three_puffs", label: "تین پف" },
                      { value: "nasal_drop_one", label: "ایک ناک کا قطرہ" },
                      { value: "nasal_drop_two", label: "دو ناک کے قطرے" },
                      { value: "ear_drop_one", label: "ایک کان کا قطرہ" },
                      { value: "ear_drop_two", label: "دو کان کے قطرے" },
                      { value: "eye_drop_one", label: "ایک آنکھ کا قطرہ" },
                      { value: "eye_drop_two", label: "دو آنکھ کے قطرے" },

                      // Patch/Cream/Ointment applications
                      { value: "thin_layer", label: "پتلی تہہ" },
                      { value: "thick_layer", label: "موٹی تہہ" },
                      { value: "small_amount", label: "تھوڑی سی مقدار" },
                      { value: "moderate_amount", label: "درمیانی مقدار" },
                      { value: "generous_amount", label: "وسیع مقدار" },
                      { value: "pea_size", label: "مٹر کے دانے جتنا" },
                      { value: "coin_size", label: "سکے جتنا" },
                      { value: "walnut_size", label: "اخروٹ جتنا" },
                      { value: "one_patch", label: "ایک پیچ" },
                      { value: "two_patches", label: "دو پیچ" },

                      // Time-specific applications
                      { value: "morning_only", label: "صرف صبح" },
                      { value: "evening_only", label: "صرف شام" },
                      { value: "night_only", label: "صرف رات" },
                      {
                        value: "first_day_loading",
                        label: "پہلے دن لوڈنگ خوراک",
                      },
                      { value: "maintenance_dose", label: "مینٹیننس خوراک" },
                      { value: "initial_dose", label: "ابتدائی خوراک" },
                      { value: "titration_dose", label: "ٹائٹریشن خوراک" },
                      { value: "maximum_dose", label: "زیادہ سے زیادہ خوراک" },
                      { value: "minimum_dose", label: "کم سے کم خوراک" },

                      // Special administration instructions
                      { value: "sublingual", label: "زیر زبان" },
                      { value: "buccal", label: "گال کے اندر" },
                      { value: "chewable", label: "چبانے والی" },
                      {
                        value: "dissolve_in_mouth",
                        label: "منہ میں گھلانے والی",
                      },
                      { value: "effervescent", label: "ابلتی ہوئی" },
                      { value: "with_water", label: "پانی کے ساتھ" },
                      { value: "without_water", label: "بغیر پانی کے" },
                      { value: "with_milk", label: "دودھ کے ساتھ" },
                      { value: "with_juice", label: "جوس کے ساتھ" },

                      // Emergency/Special situations
                      { value: "emergency_dose", label: "ایمرجنسی خوراک" },
                      { value: "rescue_dose", label: "ریسکیو خوراک" },
                      { value: "stat_dose", label: "فوری خوراک" },
                      { value: "prn_dose", label: "ضرورت پڑنے پر" },
                      { value: "breakthrough_dose", label: "بریک تھرو خوراک" },
                      { value: "loading_dose", label: "لوڈنگ خوراک" },
                      { value: "bolus_dose", label: "بولس خوراک" },
                      { value: "continuous_infusion", label: "مسلسل انفیوژن" },

                      // Measurement units for specialized medicines
                      { value: "units_100", label: "100 یونٹس" },
                      { value: "units_200", label: "200 یونٹس" },
                      { value: "units_300", label: "300 یونٹس" },
                      { value: "units_400", label: "400 یونٹس" },
                      { value: "units_500", label: "500 یونٹس" },
                      { value: "units_1000", label: "1000 یونٹس" },
                      { value: "mcg_5", label: "5 مائیکروگرام" },
                      { value: "mcg_10", label: "10 مائیکروگرام" },
                      { value: "mcg_25", label: "25 مائیکروگرام" },
                      { value: "mcg_50", label: "50 مائیکروگرام" },
                      { value: "mcg_100", label: "100 مائیکروگرام" },
                      { value: "mcg_200", label: "200 مائیکروگرام" },
                      { value: "iu_100", label: "100 آئی یو" },
                      { value: "iu_200", label: "200 آئی یو" },
                      { value: "iu_500", label: "500 آئی یو" },
                      { value: "iu_1000", label: "1000 آئی یو" },
                      { value: "iu_5000", label: "5000 آئی یو" },
                      { value: "iu_10000", label: "10000 آئی یو" },

                      // Duration-based instructions
                      { value: "for_5_days", label: "5 دن کے لیے" },
                      { value: "for_7_days", label: "7 دن کے لیے" },
                      { value: "for_10_days", label: "10 دن کے لیے" },
                      { value: "for_14_days", label: "14 دن کے لیے" },
                      { value: "for_21_days", label: "21 دن کے لیے" },
                      { value: "for_28_days", label: "28 دن کے لیے" },
                      { value: "for_one_cycle", label: "ایک سائیکل کے لیے" },
                      { value: "until_finished", label: "ختم ہونے تک" },
                      {
                        value: "until_symptoms_improve",
                        label: "علامات بہتر ہونے تک",
                      },
                      { value: "until_next_visit", label: "اگلے وزٹ تک" },

                      // Specific medical conditions
                      { value: "for_fever", label: "بخار کے لیے" },
                      { value: "for_cough", label: "کھانسی کے لیے" },
                      { value: "for_allergy", label: "الرجی کے لیے" },
                      { value: "for_infection", label: "انفیکشن کے لیے" },
                      { value: "for_inflammation", label: "سوزش کے لیے" },
                      {
                        value: "for_hypertension",
                        label: "ہائی بلڈ پریشر کے لیے",
                      },
                      { value: "for_diabetes", label: "ذیابیطس کے لیے" },
                      { value: "for_anxiety", label: "بے چینی کے لیے" },
                      { value: "for_depression", label: "ڈپریشن کے لیے" },
                      { value: "for_pain_relief", label: "درد کی آرام کے لیے" },

                      // Specialized combinations
                      { value: "with_food", label: "کھانے کے ساتھ" },
                      { value: "on_empty_stomach", label: "خالی پیٹ پر" },
                      { value: "at_same_time", label: "ہمیشہ ایک ہی وقت پر" },
                      { value: "alternating_days", label: "متبادل دنوں میں" },
                      {
                        value: "cycle_days_1_5",
                        label: "سائیکل کے دن 1 سے 5 تک",
                      },
                      {
                        value: "cycle_days_1_21",
                        label: "سائیکل کے دن 1 سے 21 تک",
                      },
                      { value: "every_monday", label: "ہر پیر کو" },
                      { value: "every_sunday", label: "ہر اتوار کو" },

                      // Additional practical options
                      { value: "half_strength", label: "آدھی طاقت" },
                      { value: "full_strength", label: "پوری طاقت" },
                      { value: "double_strength", label: "دوہری طاقت" },
                      { value: "diluted", label: "پتلا کیا ہوا" },
                      { value: "concentrated", label: "گاڑھا" },
                      { value: "freshly_prepared", label: "تازہ تیار شدہ" },
                      { value: "refrigerated", label: "ریفریجریٹڈ" },
                      {
                        value: "room_temperature",
                        label: "کمرے کے درجہ حرارت پر",
                      },
                      { value: "warmed", label: "گرم کیا ہوا" },
                      { value: "chilled", label: "ٹھنڈا کیا ہوا" },

                      // Patient-specific instructions
                      { value: "if_tolerated", label: "اگر برداشت ہو" },
                      { value: "if_needed", label: "اگر ضرورت ہو" },
                      {
                        value: "unless_contraindicated",
                        label: "جب تک مخالف نہ ہو",
                      },
                      { value: "with_caution", label: "احتیاط کے ساتھ" },
                      { value: "under_supervision", label: "نگرانی میں" },
                      {
                        value: "self_administered",
                        label: "خود دیا جانے والا",
                      },
                      {
                        value: "by_caregiver",
                        label: "دیکھ بھال کرنے والے کے ذریعے",
                      },
                      { value: "in_clinic", label: "کلینک میں" },
                      { value: "at_home", label: "گھر پر" },
                      {
                        value: "during_hospitalization",
                        label: "ہسپتال میں رہنے کے دوران",
                      },
                    ]}
                    value={
                      med.dosage_en
                        ? {
                            value: med.dosage_en,
                            label: med.dosage_urdu,
                          }
                        : null
                    }
                    onChange={(option) => {
                      setSelectedMedicines((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                dosage_en: option ? option.value : "",
                                dosage_urdu: option ? option.label : "",
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder="Select dosage..."
                    isClearable
                    styles={customSelectStyles}
                    className="font-urdu"
                  />
                </div>

                {/* Duration */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">
                    Duration{courseNum > 1 ? ` (Course ${courseNum})` : ""}
                  </label>
                  <Select
                    options={courseNum > 1 ? AFTER_COURSE_DURATION_OPTIONS : [
                      { value: "1_day", label: "1 دن" },
                      { value: "2_days", label: "2 دن" },
                      { value: "3_days", label: "3 دن" },
                      { value: "4_days", label: "4 دن" },
                      { value: "5_days", label: "5 دن" },
                      { value: "6_days", label: "6 دن" },
                      { value: "7_days", label: "1 ہفتہ (7 دن)" },
                      { value: "8_days", label: "8 دن" },
                      { value: "9_days", label: "9 دن" },
                      { value: "10_days", label: "10 دن" },
                      { value: "11_days", label: "11 دن" },
                      { value: "12_days", label: "12 دن" },
                      { value: "13_days", label: "13 دن" },
                      { value: "14_days", label: "2 ہفتے (14 دن)" },
                      { value: "15_days", label: "15 دن" },
                      { value: "16_days", label: "16 دن" },
                      { value: "17_days", label: "17 دن" },
                      { value: "18_days", label: "18 دن" },
                      { value: "19_days", label: "19 دن" },
                      { value: "20_days", label: "20 دن" },
                      { value: "21_days", label: "3 ہفتے (21 دن)" },
                      { value: "22_days", label: "22 دن" },
                      { value: "23_days", label: "23 دن" },
                      { value: "24_days", label: "24 دن" },
                      { value: "25_days", label: "25 دن" },
                      { value: "26_days", label: "26 دن" },
                      { value: "27_days", label: "27 دن" },
                      { value: "28_days", label: "4 ہفتے (28 دن)" },
                      { value: "29_days", label: "29 دن" },
                      { value: "30_days", label: "1 مہینہ (30 دن)" },
                      { value: "31_days", label: "31 دن" },
                      { value: "45_days", label: "45 دن" },
                      { value: "60_days", label: "2 مہینے (60 دن)" },
                      { value: "90_days", label: "3 مہینے (90 دن)" },

                      // Weeks (complete set)
                      { value: "1_week", label: "1 ہفتہ" },
                      { value: "1.5_weeks", label: "ڈیڑھ ہفتہ" },
                      { value: "2_weeks", label: "2 ہفتے" },
                      { value: "2.5_weeks", label: "ڈھائی ہفتے" },
                      { value: "3_weeks", label: "3 ہفتے" },
                      { value: "3.5_weeks", label: "ساڑھے تین ہفتے" },
                      { value: "4_weeks", label: "1 مہینہ (4 ہفتے)" },
                      { value: "5_weeks", label: "5 ہفتے" },
                      { value: "6_weeks", label: "6 ہفتے" },
                      { value: "7_weeks", label: "7 ہفتے" },
                      { value: "8_weeks", label: "2 مہینے (8 ہفتے)" },
                      { value: "9_weeks", label: "9 ہفتے" },
                      { value: "10_weeks", label: "10 ہفتے" },
                      { value: "11_weeks", label: "11 ہفتے" },
                      { value: "12_weeks", label: "3 مہینے (12 ہفتے)" },
                      { value: "16_weeks", label: "4 مہینے (16 ہفتے)" },
                      { value: "20_weeks", label: "5 مہینے (20 ہفتے)" },
                      { value: "24_weeks", label: "6 مہینے (24 ہفتے)" },
                      { value: "36_weeks", label: "9 مہینے (36 ہفتے)" },
                      { value: "48_weeks", label: "12 مہینے (48 ہفتے)" },

                      // Months (complete set)
                      { value: "1_month", label: "1 مہینہ" },
                      { value: "1.5_months", label: "ڈیڑھ مہینہ" },
                      { value: "2_months", label: "2 مہینے" },
                      { value: "2.5_months", label: "ڈھائی مہینے" },
                      { value: "3_months", label: "3 مہینے" },
                      { value: "3.5_months", label: "ساڑھے تین مہینے" },
                      { value: "4_months", label: "4 مہینے" },
                      { value: "5_months", label: "5 مہینے" },
                      { value: "6_months", label: "6 مہینے" },
                      { value: "7_months", label: "7 مہینے" },
                      { value: "8_months", label: "8 مہینے" },
                      { value: "9_months", label: "9 مہینے" },
                      { value: "10_months", label: "10 مہینے" },
                      { value: "11_months", label: "11 مہینے" },
                      { value: "12_months", label: "12 مہینے (1 سال)" },
                      { value: "18_months", label: "18 مہینے (ڈیڑھ سال)" },
                      { value: "24_months", label: "24 مہینے (2 سال)" },
                      { value: "36_months", label: "36 مہینے (3 سال)" },

                      // Years
                      { value: "1_year", label: "1 سال" },
                      { value: "1.5_years", label: "ڈیڑھ سال" },
                      { value: "2_years", label: "2 سال" },
                      { value: "2.5_years", label: "ڈھائی سال" },
                      { value: "3_years", label: "3 سال" },
                      { value: "4_years", label: "4 سال" },
                      { value: "5_years", label: "5 سال" },
                      { value: "10_years", label: "10 سال" },

                      // ========== "AFTER" TIME INTERVAL OPTIONS ADDED ==========
                      { value: "after_1_day", label: "1 دن بعد" },
                      { value: "after_2_days", label: "2 دن بعد" },
                      { value: "after_3_days", label: "3 دن بعد" },
                      { value: "after_4_days", label: "4 دن بعد" },
                      { value: "after_5_days", label: "5 دن بعد" },
                      { value: "after_6_days", label: "6 دن بعد" },
                      { value: "after_1_week", label: "1 ہفتہ بعد" },
                      { value: "after_10_days", label: "10 دن بعد" },
                      { value: "after_2_weeks", label: "2 ہفتے بعد" },
                      { value: "after_3_weeks", label: "3 ہفتے بعد" },
                      { value: "after_1_month", label: "1 مہینہ بعد" },
                      { value: "after_6_weeks", label: "6 ہفتے بعد" },
                      { value: "after_2_months", label: "2 مہینے بعد" },
                      { value: "after_10_weeks", label: "10 ہفتے بعد" },
                      { value: "after_3_months", label: "3 مہینے بعد" },
                      { value: "after_4_months", label: "4 مہینے بعد" },
                      { value: "after_5_months", label: "5 مہینے بعد" },
                      { value: "after_6_months", label: "6 مہینے بعد" },
                      { value: "after_9_months", label: "9 مہینے بعد" },
                      { value: "after_1_year", label: "1 سال بعد" },
                      { value: "after_18_months", label: "ڈیڑھ سال بعد" },
                      { value: "after_2_years", label: "2 سال بعد" },
                      { value: "after_3_years", label: "3 سال بعد" },
                      { value: "after_5_years", label: "5 سال بعد" },
                      { value: "after_10_years", label: "10 سال بعد" },
                      {
                        value: "after_finishing_course",
                        label: "کورس ختم کرنے کے بعد",
                      },
                      { value: "after_meal", label: "کھانے کے بعد" },
                      {
                        value: "after_before_meal",
                        label: "کھانے سے پہلے اور بعد",
                      },
                      {
                        value: "after_symptoms_improve",
                        label: "علامات بہتر ہونے کے بعد",
                      },
                      {
                        value: "after_test_results",
                        label: "ٹیسٹ رزلٹس کے بعد",
                      },
                      {
                        value: "after_doctor_visit",
                        label: "ڈاکٹر کے وزٹ کے بعد",
                      },
                      { value: "after_surgery", label: "سرجری کے بعد" },
                      { value: "after_procedure", label: "پروسیجر کے بعد" },
                      { value: "after_delivery", label: "ڈیلیوری کے بعد" },
                      { value: "after_injury", label: "چوٹ لگنے کے بعد" },
                      { value: "after_infection", label: "انفیکشن کے بعد" },
                      {
                        value: "after_fever_subsides",
                        label: "بخار اترنے کے بعد",
                      },
                      {
                        value: "after_pain_relief",
                        label: "درد آرام ہونے کے بعد",
                      },

                      // Special durations
                      { value: "long_term", label: "طویل مدتی علاج" },
                      { value: "short_term", label: "مختصر مدتی علاج" },
                      { value: "as_needed", label: "ضرورت کے مطابق" },
                      {
                        value: "medium_term",
                        label: "درمیانی مدتی علاج (2-4 ہفتے)",
                      },
                      { value: "lifetime", label: "زندگی بھر کے لیے" },
                      { value: "until_improved", label: "بہتری تک" },
                      {
                        value: "until_test_normal",
                        label: "ٹیسٹ معمول ہونے تک",
                      },
                      {
                        value: "until_symptoms_resolve",
                        label: "علامات ختم ہونے تک",
                      },
                      { value: "continuous", label: "مسلسل استعمال" },
                      { value: "intermittent", label: "وقتاً فوقتاً استعمال" },
                      {
                        value: "cyclic",
                        label: "چکری استعمال (مخصوص دورانیے کے لیے)",
                      },
                      { value: "alternate_days", label: "ایک دن چھوڑ کر" },
                      {
                        value: "weekly_cycles",
                        label:
                          "ہفتہ وار چکر (مثلاً 3 ہفتے استعمال، 1 ہفتہ آرام)",
                      },
                      { value: "monthly_cycles", label: "ماہانہ چکر" },
                      {
                        value: "as_prescribed",
                        label: "ڈاکٹر کے مشورے کے مطابق",
                      },

                      // ========== ADDITIONAL INTERVAL OPTIONS ==========
                      { value: "once_weekly", label: "ہفتے میں ایک بار" },
                      { value: "twice_weekly", label: "ہفتے میں دو بار" },
                      { value: "thrice_weekly", label: "ہفتے میں تین بار" },
                      { value: "once_monthly", label: "مہینے میں ایک بار" },
                      { value: "twice_monthly", label: "مہینے میں دو بار" },
                      { value: "once_every_3_months", label: "ہر 3 مہینے بعد" },
                      { value: "once_every_6_months", label: "ہر 6 مہینے بعد" },
                      { value: "once_yearly", label: "سال میں ایک بار" },
                      { value: "twice_yearly", label: "سال میں دو بار" },
                      { value: "every_other_day", label: "ایک دن چھوڑ کر" },
                      { value: "every_third_day", label: "ہر تیسرے دن" },
                      { value: "every_fourth_day", label: "ہر چوتھے دن" },
                      { value: "every_fifth_day", label: "ہر پانچویں دن" },
                      { value: "every_sixth_day", label: "ہر چھٹے دن" },
                      { value: "once_every_week", label: "ہر ہفتے" },
                      { value: "once_every_2_weeks", label: "ہر 2 ہفتے بعد" },
                      { value: "once_every_3_weeks", label: "ہر 3 ہفتے بعد" },
                      { value: "once_every_4_weeks", label: "ہر 4 ہفتے بعد" },
                      { value: "once_every_8_weeks", label: "ہر 8 ہفتے بعد" },
                      { value: "once_every_12_weeks", label: "ہر 12 ہفتے بعد" },
                      { value: "once_every_24_weeks", label: "ہر 24 ہفتے بعد" },
                      { value: "once_every_48_weeks", label: "ہر 48 ہفتے بعد" },
                      { value: "before_meal", label: "کھانے سے پہلے" },
                      { value: "with_meal", label: "کھانے کے ساتھ" },
                      { value: "after_breakfast", label: "ناشتے کے بعد" },
                      { value: "after_lunch", label: "دوپہر کے کھانے کے بعد" },
                      { value: "after_dinner", label: "رات کے کھانے کے بعد" },
                      { value: "before_sleep", label: "سونے سے پہلے" },
                      { value: "upon_waking", label: "صبح اٹھتے ہی" },
                      { value: "mid_morning", label: "دوپہر سے پہلے" },
                      { value: "mid_afternoon", label: "دوپہر کے بعد" },
                      { value: "late_evening", label: "رات سے پہلے" },
                    ]}
                    value={
                      med.duration_en
                        ? {
                            value: med.duration_en,
                            label: med.duration_urdu,
                          }
                        : null
                    }
                    onChange={(option) => {
                      setSelectedMedicines((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                duration_en: option ? option.value : "",
                                duration_urdu: option ? option.label : "",
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder="Select duration..."
                    isClearable
                    styles={customSelectStyles}
                    className="font-urdu"
                  />
                </div>

                {/* Instruction */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">
                    Instruction
                  </label>
                  <Select
                    options={[
                      { value: "before_meal", label: "کھانے سے پہلے" },
                      { value: "with_meal", label: "کھانے کے ساتھ" },
                      { value: "after_meal", label: "کھانے کے بعد" },
                      { value: "empty_stomach", label: "خالی پیٹ" },
                      { value: "between_meals", label: "کھانوں کے درمیان" },

                      // Specific meal timings
                      { value: "before_breakfast", label: "ناشتے سے پہلے" },
                      { value: "with_breakfast", label: "ناشتے کے ساتھ" },
                      { value: "after_breakfast", label: "ناشتے کے بعد" },
                      {
                        value: "before_lunch",
                        label: "دوپہر کے کھانے سے پہلے",
                      },
                      { value: "with_lunch", label: "دوپہر کے کھانے کے ساتھ" },
                      { value: "after_lunch", label: "دوپہر کے کھانے کے بعد" },
                      { value: "before_dinner", label: "رات کے کھانے سے پہلے" },
                      { value: "with_dinner", label: "رات کے کھانے کے ساتھ" },
                      { value: "after_dinner", label: "رات کے کھانے کے بعد" },
                      { value: "before_snack", label: "ہلکے کھانے سے پہلے" },
                      { value: "with_snack", label: "ہلکے کھانے کے ساتھ" },
                      { value: "after_snack", label: "ہلکے کھانے کے بعد" },

                      // Fluid-related timings
                      { value: "with_water", label: "پانی کے ساتھ" },
                      { value: "with_milk", label: "دودھ کے ساتھ" },
                      { value: "with_juice", label: "جوس کے ساتھ" },
                      { value: "before_tea", label: "چائے سے پہلے" },
                      { value: "after_tea", label: "چائے کے بعد" },
                      { value: "with_tea", label: "چائے کے ساتھ" },
                      { value: "before_coffee", label: "کافی سے پہلے" },
                      { value: "after_coffee", label: "کافی کے بعد" },

                      // Food-specific instructions
                      { value: "with_yogurt", label: "دہی کے ساتھ" },
                      { value: "with_honey", label: "شہد کے ساتھ" },
                      {
                        value: "with_fatty_foods",
                        label: "چکنائی والے کھانے کے ساتھ",
                      },
                      {
                        value: "with_high_fiber",
                        label: "ریشے دار کھانے کے ساتھ",
                      },
                      {
                        value: "with_protein",
                        label: "پروٹین والے کھانے کے ساتھ",
                      },
                      { value: "without_dairy", label: "ڈیری مصنوعات کے بغیر" },
                      {
                        value: "without_iron",
                        label: "آئرن والی غذاؤں کے بغیر",
                      },
                      {
                        value: "without_calcium",
                        label: "کیلشیم والی غذاؤں کے بغیر",
                      },

                      // Special conditions
                      { value: "only_if_needed", label: "ضرورت کے مطابق" },
                      { value: "avoid_caffeine", label: "کیفین سے بچیں" },
                      { value: "avoid_alcohol", label: "الکحل سے بچیں" },
                      { value: "avoid_grapefruit", label: "گریپ فروٹ سے بچیں" },
                      { value: "avoid_sun", label: "دھوپ سے بچیں" },
                      { value: "on_awakening", label: "صبح بیدار ہوتے ہی" },
                      { value: "at_bedtime", label: "سونے سے پہلے" },
                      { value: "during_pain", label: "درد ہونے پر" },
                      { value: "during_nausea", label: "متلی ہونے پر" },
                      { value: "during_heartburn", label: "سینے کی جلن پر" },

                      // Body position instructions
                      {
                        value: "upright_position",
                        label: "کھڑے ہو کر/بیٹھ کر",
                      },
                      { value: "lying_down", label: "لیٹ کر" },
                      { value: "left_side", label: "بائیں کروٹ لیٹ کر" },
                      { value: "right_side", label: "دائیں کروٹ لیٹ کر" },

                      // Special administration instructions
                      { value: "chew_tab", label: "چبا کر کھائیں" },
                      {
                        value: "dissolve_in_mouth",
                        label: "منہ میں گولی رکھ کر گلیں",
                      },
                      { value: "sublingual", label: "زیر زبان رکھیں" },
                      {
                        value: "with_full_glass",
                        label: "ایک گلاس پانی کے ساتھ",
                      },
                      { value: "without_water", label: "بغیر پانی کے" },
                      { value: "on_empty_bladder", label: "خالی مثانے پر" },
                      { value: "on_full_bladder", label: "بھرے مثانے پر" },

                      // Time-specific instructions
                      { value: "morning", label: "صبح" },
                      { value: "noon", label: "دوپہر" },
                      { value: "evening", label: "شام" },
                      { value: "night", label: "رات" },
                      { value: "every_morning", label: "روزانہ صبح" },
                      { value: "every_night", label: "روزانہ رات" },
                      { value: "alternate_days", label: "ایک دن چھوڑ کر" },
                      { value: "after_one_week", label: "ایک ہفتے بعد" },
                      { value: "after_two_weeks", label: "دو ہفتے بعد" },
                      { value: "after_three_weeks", label: "تین ہفتے بعد" },
                      { value: "after_one_month", label: "ایک مہینے بعد" },

                      // ========== EXCELLENT NEW ADDITIONS ==========

                      // Temperature-based instructions
                      {
                        value: "room_temperature",
                        label: "کمرے کے درجہ حرارت پر",
                      },
                      { value: "refrigerated", label: "فریج سے نکال کر" },
                      { value: "warm_water", label: "نیم گرم پانی کے ساتھ" },
                      { value: "cold_water", label: "ٹھنڈے پانی کے ساتھ" },
                      {
                        value: "body_temperature",
                        label: "جسم کے درجہ حرارت پر",
                      },

                      // Preparation instructions
                      { value: "shake_well", label: "اچھی طرح ہلائیں" },
                      { value: "do_not_shake", label: "نہ ہلائیں" },
                      { value: "mix_well", label: "اچھی طرح مکس کریں" },
                      { value: "freshly_prepared", label: "تازہ تیار شدہ" },
                      {
                        value: "dilute_before_use",
                        label: "استعمال سے پہلے پتلا کریں",
                      },
                      {
                        value: "use_undiluted",
                        label: "بغیر پتلے کیے استعمال کریں",
                      },

                      // Storage-related instructions
                      { value: "store_refrigerated", label: "فریج میں رکھیں" },
                      {
                        value: "store_room_temp",
                        label: "کمرے کے درجہ حرارت پر رکھیں",
                      },
                      {
                        value: "protect_from_light",
                        label: "روشنی سے بچا کر رکھیں",
                      },
                      {
                        value: "protect_from_moisture",
                        label: "نمی سے بچا کر رکھیں",
                      },
                      {
                        value: "keep_in_original_pack",
                        label: "اصل پیکٹ میں رکھیں",
                      },

                      // Special dietary instructions
                      { value: "with_fruit", label: "پھل کے ساتھ" },
                      { value: "with_bread", label: "روٹی کے ساتھ" },
                      { value: "with_rice", label: "چاول کے ساتھ" },
                      {
                        value: "avoid_spicy_food",
                        label: "مسالہ دار کھانے سے بچیں",
                      },
                      {
                        value: "avoid_salty_food",
                        label: "نمکین کھانے سے بچیں",
                      },
                      {
                        value: "avoid_sweet_food",
                        label: "میٹھے کھانے سے بچیں",
                      },
                      {
                        value: "low_sodium_diet",
                        label: "کم نمک والی خوراک کے ساتھ",
                      },
                      {
                        value: "low_fat_diet",
                        label: "کم چکنائی والی خوراک کے ساتھ",
                      },

                      // Medication-specific combinations
                      {
                        value: "separate_by_2_hours",
                        label: "دوسری دوائی سے 2 گھنٹے کے فاصلے پر",
                      },
                      {
                        value: "separate_by_4_hours",
                        label: "دوسری دوائی سے 4 گھنٹے کے فاصلے پر",
                      },
                      {
                        value: "separate_by_6_hours",
                        label: "دوسری دوائی سے 6 گھنٹے کے فاصلے پر",
                      },
                      {
                        value: "take_alone",
                        label: "دوسری دوائیوں سے الگ لیں",
                      },
                      {
                        value: "can_take_together",
                        label: "دوسری دوائیوں کے ساتھ لے سکتے ہیں",
                      },

                      // Activity-related instructions
                      {
                        value: "rest_after_dose",
                        label: "خوراک کے بعد آرام کریں",
                      },
                      { value: "avoid_driving", label: "گاڑی چلانے سے بچیں" },
                      {
                        value: "avoid_machinery",
                        label: "مشینری استعمال سے بچیں",
                      },
                      {
                        value: "light_activity_only",
                        label: "صرف ہلکی سرگرمی",
                      },
                      {
                        value: "no_strenuous_activity",
                        label: "سخت سرگرمی سے گریز کریں",
                      },
                      {
                        value: "stay_hydrated",
                        label: "خود کو ہائیڈریٹ رکھیں",
                      },

                      // Monitoring instructions
                      {
                        value: "monitor_blood_pressure",
                        label: "بلڈ پریشر چیک کرتے رہیں",
                      },
                      {
                        value: "monitor_blood_sugar",
                        label: "بلڈ شوگر چیک کرتے رہیں",
                      },
                      {
                        value: "check_weight_daily",
                        label: "روزانہ وزن چیک کریں",
                      },
                      {
                        value: "monitor_symptoms",
                        label: "علامات پر نظر رکھیں",
                      },
                      {
                        value: "report_side_effects",
                        label: "مضر اثرات رپورٹ کریں",
                      },

                      // Special patient populations
                      { value: "for_children", label: "بچوں کے لیے" },
                      { value: "for_adults", label: "بالغوں کے لیے" },
                      { value: "for_elderly", label: "بوڑھوں کے لیے" },
                      { value: "for_pregnant", label: "حاملہ خواتین کے لیے" },
                      {
                        value: "for_breastfeeding",
                        label: "دودھ پلانے والی ماؤں کے لیے",
                      },

                      // Emergency/PRN instructions
                      {
                        value: "emergency_use_only",
                        label: "صرف ایمرجنسی میں استعمال کریں",
                      },
                      {
                        value: "first_aid_use",
                        label: "فرسٹ ایڈ کے طور پر استعمال کریں",
                      },
                      {
                        value: "for_severe_pain",
                        label: "شدید درد کی صورت میں",
                      },
                      {
                        value: "for_high_fever",
                        label: "زیادہ بخار کی صورت میں",
                      },
                      {
                        value: "for_allergic_reaction",
                        label: "الرجک رد عمل کی صورت میں",
                      },

                      // Wound/Skin care instructions
                      { value: "clean_area_first", label: "پہلے جگہ صاف کریں" },
                      { value: "apply_thin_layer", label: "پتلی تہہ لگائیں" },
                      { value: "apply_thick_layer", label: "موٹی تہہ لگائیں" },
                      { value: "cover_with_bandage", label: "پٹی سے ڈھانپیں" },
                      { value: "leave_uncovered", label: "کھلا رہنے دیں" },
                      { value: "massage_gentle", label: "آہستہ سے مالش کریں" },

                      // Eye/Ear/Nose drops instructions
                      { value: "tilt_head_back", label: "سر پیچھے جھکائیں" },
                      { value: "pull_earlobe", label: "کان کی لو کو کھینچیں" },
                      {
                        value: "close_eyes_after",
                        label: "قطرے ڈالنے کے بعد آنکھیں بند کریں",
                      },
                      {
                        value: "press_nasal_corner",
                        label: "ناک کے کونے کو دبائیں",
                      },
                      { value: "wait_5_minutes", label: "5 منٹ انتظار کریں" },

                      // Inhaler/Nebulizer instructions
                      { value: "shake_inhaler", label: "انہیلر ہلائیں" },
                      {
                        value: "breathe_out_first",
                        label: "پہلے سانس باہر نکالیں",
                      },
                      {
                        value: "breathe_in_slowly",
                        label: "آہستہ سانس اندر لیں",
                      },
                      {
                        value: "hold_breath_10sec",
                        label: "10 سیکنڈ سانس روکیں",
                      },
                      {
                        value: "rinse_mouth_after",
                        label: "استعمال کے بعد منہ صاف کریں",
                      },

                      // Surgical/Procedure-related
                      { value: "pre_operative", label: "آپریشن سے پہلے" },
                      { value: "post_operative", label: "آپریشن کے بعد" },
                      { value: "before_procedure", label: "پروسیجر سے پہلے" },
                      { value: "after_procedure", label: "پروسیجر کے بعد" },
                      {
                        value: "npo_before_procedure",
                        label: "پروسیجر سے پہلے کچھ نہ کھائیں پییں",
                      },

                      // Laboratory/Test instructions
                      { value: "before_blood_test", label: "بلڈ ٹیسٹ سے پہلے" },
                      { value: "after_blood_test", label: "بلڈ ٹیسٹ کے بعد" },
                      { value: "fasting_required", label: "فاسٹنگ ضروری ہے" },
                      {
                        value: "no_fasting_required",
                        label: "فاسٹنگ ضروری نہیں",
                      },
                      {
                        value: "avoid_exercise_before",
                        label: "ٹیسٹ سے پہلے ورزش سے بچیں",
                      },

                      // Duration and frequency clarity
                      { value: "for_5_days", label: "5 دن کے لیے" },
                      { value: "for_7_days", label: "7 دن کے لیے" },
                      { value: "for_10_days", label: "10 دن کے لیے" },
                      { value: "for_14_days", label: "14 دن کے لیے" },
                      { value: "until_finished", label: "ختم ہونے تک" },
                      {
                        value: "until_symptoms_clear",
                        label: "علامات ختم ہونے تک",
                      },
                      {
                        value: "lifelong_use",
                        label: "زندگی بھر استعمال کریں",
                      },

                      // Missed dose instructions
                      {
                        value: "skip_if_missed",
                        label: "چھوٹ جائے تو چھوڑ دیں",
                      },
                      {
                        value: "take_when_remember",
                        label: "یاد آئے تو فوراً لیں",
                      },
                      {
                        value: "do_not_double_dose",
                        label: "دوہری خوراک ہرگز نہ لیں",
                      },
                      {
                        value: "take_next_dose_time",
                        label: "اگلی خوراک مقررہ وقت پر لیں",
                      },

                      // Disposal instructions
                      {
                        value: "dispose_properly",
                        label: "صحیح طریقے سے ضائع کریں",
                      },
                      {
                        value: "return_to_pharmacy",
                        label: "دواخانے کو واپس کریں",
                      },
                      { value: "do_not_flush", label: "ٹوائیلٹ میں نہ بہائیں" },
                      {
                        value: "keep_out_of_reach",
                        label: "بچوں کی پہنچ سے دور رکھیں",
                      },

                      // Additional timing precision
                      {
                        value: "30_min_before_meal",
                        label: "کھانے سے 30 منٹ پہلے",
                      },
                      {
                        value: "1_hour_before_meal",
                        label: "کھانے سے 1 گھنٹہ پہلے",
                      },
                      {
                        value: "2_hours_before_meal",
                        label: "کھانے سے 2 گھنٹے پہلے",
                      },
                      {
                        value: "30_min_after_meal",
                        label: "کھانے کے 30 منٹ بعد",
                      },
                      {
                        value: "1_hour_after_meal",
                        label: "کھانے کے 1 گھنٹہ بعد",
                      },
                      {
                        value: "2_hours_after_meal",
                        label: "کھانے کے 2 گھنٹے بعد",
                      },

                      // Exact time instructions
                      { value: "at_8_am", label: "صبح 8 بجے" },
                      { value: "at_12_pm", label: "دوپہر 12 بجے" },
                      { value: "at_6_pm", label: "شام 6 بجے" },
                      { value: "at_10_pm", label: "رات 10 بجے" },
                      {
                        value: "same_time_daily",
                        label: "روزانہ ایک ہی وقت پر",
                      },

                      // Pregnancy/Lactation specific
                      {
                        value: "if_pregnancy_suspected",
                        label: "اگر حمل کا شبہ ہو",
                      },
                      {
                        value: "stop_if_pregnant",
                        label: "حمل کی صورت میں بند کریں",
                      },
                      {
                        value: "consult_if_breastfeeding",
                        label: "دودھ پلانے کی صورت میں مشورہ کریں",
                      },

                      // Special warnings
                      {
                        value: "may_cause_drowsiness",
                        label: "نیند طاری کر سکتا ہے",
                      },
                      { value: "may_cause_dizziness", label: "چکر آ سکتے ہیں" },
                      {
                        value: "photosensitivity_warning",
                        label: "دھوپ میں حساسیت ہو سکتی ہے",
                      },
                      {
                        value: "may_stain_teeth",
                        label: "دانت رنگین کر سکتا ہے",
                      },
                      {
                        value: "may_darken_urine",
                        label: "پیشاب کا رنگ گہرا کر سکتا ہے",
                      },

                      // Food/Drink compatibility
                      {
                        value: "can_take_with_any_food",
                        label: "کسی بھی کھانے کے ساتھ لے سکتے ہیں",
                      },
                      {
                        value: "must_take_with_food",
                        label: "ضرور کھانے کے ساتھ لیں",
                      },
                      {
                        value: "must_take_without_food",
                        label: "ضرور کھانے کے بغیر لیں",
                      },
                      {
                        value: "food_does_not_matter",
                        label: "کھانے کا اثر نہیں پڑتا",
                      },
                    ]}
                    value={
                      med.instructions_en
                        ? {
                            value: med.instructions_en,
                            label: med.instructions_urdu,
                          }
                        : null
                    }
                    onChange={(option) => {
                      setSelectedMedicines((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                instructions_en: option ? option.value : "",
                                instructions_urdu: option ? option.label : "",
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder="Select instruction..."
                    isClearable
                    styles={customSelectStyles}
                    className="font-urdu"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => handleAddCourse(index, med)}
                  title="Add another course of this medicine"
                  className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg p-1 transition-colors"
                  disabled={!med.medicine_id}
                >
                  <AiOutlinePlus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedMedicines((prev) =>
                      prev.filter((_, i) => i !== index),
                    );
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg p-1 transition-colors"
                >
                  <AiOutlineCloseCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            );
          })}

          <button
            onClick={() => handleAddMedicine()}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 p-4 transition-all cursor-pointer"
            disabled={isCreating}
          >
            <AiOutlinePlus className="w-5 h-5" />
            Add New Medication
          </button>
        </div>
      )}
    </div>
  );
};

export default PrescriptionManagementSection;
