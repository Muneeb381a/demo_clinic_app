import React, { useState } from "react";
import CreatableSelect from "react-select/creatable";
import { FaInfoCircle, FaExclamationTriangle } from "react-icons/fa";

const SymptomsSelector = ({
  allSymptoms = [],
  selectedSymptoms = [],
  rawSymptoms = [],
  onSelect,
  onCreate,
  isLoading = false,
  symptomsError = null,
}) => {
  const [creatingSymptom, setCreatingSymptom] = useState(false);
  const [createError, setCreateError] = useState(null);

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "48px",
      borderWidth: "2px",
      borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb",
      borderRadius: "10px",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(139, 92, 246, 0.2)" : "none",
      "&:hover": { borderColor: "#8b5cf6" },
      transition: "all 0.2s ease",
    }),
    option: (base, { isFocused, isSelected }) => ({
      ...base,
      backgroundColor: isSelected ? "#8b5cf6" : isFocused ? "#ede9fe" : "white",
      color: isSelected ? "white" : "#4b5563",
      padding: "10px 16px",
      fontSize: "14px",
      "&:active": { backgroundColor: "#7c3aed" },
    }),
    multiValue: (base, { data }) => ({
      ...base,
      backgroundColor: data.isDisabled ? "#f3f4f6" : "#f3f0ff",
      borderRadius: "8px",
      padding: "2px 6px",
      opacity: data.isDisabled ? 0.7 : 1,
    }),
    multiValueLabel: (base, { data }) => ({
      ...base,
      color: data.isDisabled ? "#6b7280" : "#7c3aed",
      fontWeight: "500",
      fontSize: "14px",
      padding: data.isDisabled ? "0 4px" : "0 4px 0 8px",
    }),
    multiValueRemove: (base, { data }) => ({
      ...base,
      color: data.isDisabled ? "#9ca3af" : "#7c3aed",
      borderRadius: "0 8px 8px 0",
      ":hover": {
        backgroundColor: data.isDisabled ? "#e5e7eb" : "#ddd6fe",
        color: data.isDisabled ? "#6b7280" : "#5b21b6",
      },
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af",
      fontSize: "14px",
    }),
    input: (base) => ({
      ...base,
      color: "#4b5563",
      fontSize: "14px",
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: "#9ca3af",
      padding: "8px",
      ":hover": { color: "#6b7280" },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: "#9ca3af",
      padding: "8px",
      ":hover": { color: "#6b7280" },
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: "#e5e7eb",
    }),
    loadingIndicator: (base) => ({
      ...base,
      color: "#8b5cf6",
    }),
  };

  const handleChange = (newValue) => {
    try {
      const selectedIds = newValue
        ? newValue
            .filter((opt) => !opt.isDisabled && opt.value)
            .map((opt) => Number(opt.value))
            .filter((id) => !isNaN(id))
        : [];
      setCreateError(null);
      onSelect(selectedIds);
    } catch (error) {
      setCreateError("Failed to update selection");
    }
  };

  const handleCreate = async (inputValue) => {
    const trimmedValue = inputValue?.trim();
    if (!trimmedValue) {
      setCreateError("Symptom name cannot be empty");
      return;
    }

    try {
      setCreatingSymptom(true);
      setCreateError(null);
      const newId = await onCreate(trimmedValue);
      if (newId && !isNaN(newId)) {
        onSelect([...selectedSymptoms, Number(newId)]);
      } else {
        setCreateError("Failed to create symptom: Invalid ID returned");
      }
    } catch (error) {
      setCreateError(error.message || "Failed to create symptom");
    } finally {
      setCreatingSymptom(false);
    }
  };

  const selectedOptions = selectedSymptoms
    .map((id) => {
      const symptom = allSymptoms.find((s) => s.id === Number(id));
      if (!symptom) {
        return null;
      }
      return { value: symptom.id, label: symptom.name };
    })
    .filter(Boolean);

  const fallbackOptions = rawSymptoms
    .filter(
      (name) =>
        name &&
        typeof name === "string" &&
        !allSymptoms.some((s) => s.name.toLowerCase() === name.toLowerCase()) &&
        !selectedOptions.some(
          (opt) => opt.label.toLowerCase() === name.toLowerCase()
        )
    )
    .map((name) => ({
      value: `temp_${name}`,
      label: name,
      isDisabled: true,
    }));


  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        Symptoms
        {selectedOptions.length > 0 && (
          <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
            {selectedOptions.length} selected
          </span>
        )}
      </label>

      <CreatableSelect
        isMulti
        isClearable
        isDisabled={isLoading && !creatingSymptom}
        isLoading={creatingSymptom}
        onChange={handleChange}
        onCreateOption={handleCreate}
        options={allSymptoms.map((symptom) => ({
          value: symptom.id,
          label: symptom.name,
        }))}
        value={selectedOptions} // Only selectedOptions, not fallbackOptions
        placeholder="Search or create symptoms..."
        styles={customStyles}
        classNamePrefix="react-select"
        noOptionsMessage={() => "Type to create a new symptom"}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        loadingMessage={() => "Creating symptom..."}
      />

      {createError || symptomsError ? (
        <div className="flex items-start gap-2 mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <FaExclamationTriangle className="flex-shrink-0 mt-0.5" />
          <p>{createError || symptomsError}</p>
        </div>
      ) : null}

      {fallbackOptions.length > 0 && (
        <div className="flex items-start gap-2 mt-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
          <FaExclamationTriangle className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Unrecognized symptoms:</p>
            <p className="text-gray-600">
              {fallbackOptions.map((opt) => opt.label).join(", ")}
            </p>
            <p className="mt-1 text-xs text-yellow-700">
              These symptoms weren't found in our database and can't be
              selected.
            </p>
          </div>
        </div>
      )}

      {selectedOptions.length === 0 &&
        !fallbackOptions.length &&
        !createError &&
        !symptomsError && (
          <div className="flex items-start gap-2 mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            <FaInfoCircle className="flex-shrink-0 mt-0.5" />
            <div>
              <p>Start typing to search or create symptoms</p>
              <p className="mt-1 text-xs text-blue-700">
                You can select multiple symptoms from the list or create new
                ones.
              </p>
            </div>
          </div>
        )}
    </div>
  );
};

export default SymptomsSelector;
