import React, { useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import {
  FaFlask,
  FaSearch,
  FaTimes,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

const TestsSelector = ({
  allTests = [],
  selectedTests = [],
  onSelect,
  onCreate,
  isLoading = false,
  testsError = null,
}) => {
  const [creatingTest, setCreatingTest] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Log inputs for debugging

  // Validate and map allTests to testOptions
  const testOptions = useMemo(() => {
    if (!Array.isArray(allTests)) {
      return [];
    }
    const options = allTests
      .filter((test) => test && test.id != null && test.test_name)
      .map((test) => ({
        value: test.id,
        label: test.test_name,
      }));
    return options;
  }, [allTests]);

  // Filter valid selected tests
  const selectedTestOptions = useMemo(() => {
    if (!Array.isArray(selectedTests)) {
      return [];
    }
    const options = selectedTests
      .map((testId) => {
        const option = testOptions.find((opt) => opt.value === testId);
        if (!option) {
          return null;
        }
        return option;
      })
      .filter(Boolean);
    return options;
  }, [selectedTests, testOptions]);

  const handleChange = (selectedOptions) => {
    try {
      const newSelectedIds = selectedOptions
        ? selectedOptions.map((option) => option.value)
        : [];
      setCreateError(null);
      if (onSelect) {
        onSelect(newSelectedIds);
      } else {
      }
    } catch (error) {
      setCreateError("Failed to update test selection");
    }
  };

  const handleCreate = async (inputValue) => {
    const trimmedValue = inputValue?.trim();
    if (!trimmedValue) {
      setCreateError("Test name cannot be empty");
      return;
    }

    try {
      setCreatingTest(true);
      setCreateError(null);
      if (!onCreate) {
        setCreateError("Cannot create test: No creation function provided");
        return;
      }
      const newId = await onCreate(trimmedValue);
      if (newId && !isNaN(newId)) {
        onSelect([...selectedTests, Number(newId)]);
      } else {
        setCreateError("Failed to create test: Invalid ID returned");
      }
    } catch (error) {
      setCreateError(error.message || "Failed to create test");
    } finally {
      setCreatingTest(false);
    }
  };

  // Custom styles (aligned with SymptomsSelector)
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
    multiValue: (base) => ({
      ...base,
      backgroundColor: "#f3f0ff",
      borderRadius: "8px",
      padding: "2px 6px",
      display: "flex",
      alignItems: "center",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "#7c3aed",
      fontWeight: "500",
      fontSize: "14px",
      padding: "0 4px 0 8px",
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "#7c3aed",
      borderRadius: "0 8px 8px 0",
      padding: "0 6px",
      cursor: "pointer",
      ":hover": { backgroundColor: "#ddd6fe", color: "#5b21b6" },
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

  return (
    <div className="space-y-4">
      <label
        htmlFor="tests-selector"
        className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
      >
        <FaFlask className="text-purple-500" />
        <span>Diagnostic Tests</span>
        {selectedTestOptions.length > 0 && (
          <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
            {selectedTestOptions.length} selected
          </span>
        )}
      </label>

      {testOptions.length === 0 && !isLoading ? (
        <div className="text-sm text-yellow-600 bg-yellow-50 px-4 py-3 rounded-lg border border-yellow-100 flex items-start gap-2">
          <FaExclamationTriangle className="flex-shrink-0 mt-0.5" />
          <p>No tests available. Type to create a new test.</p>
        </div>
      ) : (
        <CreatableSelect
          inputId="tests-selector"
          options={testOptions}
          value={selectedTestOptions}
          onChange={handleChange}
          onCreateOption={handleCreate}
          isMulti
          isClearable
          isDisabled={isLoading && !creatingTest}
          isLoading={creatingTest}
          placeholder="Search or create tests..."
          styles={customStyles}
          className="react-select-container"
          classNamePrefix="react-select"
          aria-label="Select or create diagnostic tests"
          components={{
            DropdownIndicator: () => (
              <FaSearch className="mr-1 text-gray-400" />
            ),
            MultiValueRemove: ({ data, innerProps }) => (
              <div
                {...innerProps}
                className="cursor-pointer p-1 hover:bg-purple-100 rounded-r-md"
                onClick={(e) => {
                  e.stopPropagation();
                  handleChange(
                    selectedTestOptions.filter(
                      (opt) => opt.value !== data.value
                    )
                  );
                }}
              >
                <FaTimes className="text-purple-700 hover:text-purple-900" />
              </div>
            ),
          }}
          noOptionsMessage={() => "Type to create a new test"}
          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
          loadingMessage={() => "Creating test..."}
        />
      )}

      {createError || testsError ? (
        <div className="flex items-start gap-2 mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <FaExclamationTriangle className="flex-shrink-0 mt-0.5" />
          <p>{createError || testsError}</p>
        </div>
      ) : null}

      {selectedTestOptions.length === 0 && !createError && !testsError && (
        <div className="flex items-start gap-2 mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          <FaInfoCircle className="flex-shrink-0 mt-0.5" />
          <div>
            <p>Start typing to search or create tests</p>
            <p className="mt-1 text-xs text-blue-700">
              You can select multiple tests from the list or create new ones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestsSelector;
