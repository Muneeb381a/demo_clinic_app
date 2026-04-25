import React, { useState, useEffect, useCallback } from 'react';
import axios from '../utils/axiosClient';
import { toast } from 'react-toastify';
import CreatableSelect from 'react-select/creatable';
import Loader from '../pages/Loader';
import debounce from 'lodash/debounce';

const BASE_URL = '';

const DiagnosticTestsSection = ({
  selectedTests = [],
  onTestsChange,
}) => {
  const [tests, setTests] = useState([]);
  const [isFetchingTests, setIsFetchingTests] = useState(false);
  const [isCreatingTests, setIsCreatingTests] = useState(false);
  const [isSearchingTests, setIsSearchingTests] = useState(false);

  useEffect(() => {
    const fetchTests = async () => {
      setIsFetchingTests(true);
      try {
        const response = await axios.get(`${BASE_URL}/api/tests`, {
        });
        setTests(
          response.data.map((test) => ({
            value: String(test.id), // Use id as value
            label: test.test_name,
          }))
        );
      } catch (error) {
        toast.error(`Failed to fetch tests: ${error.response?.data?.error || error.message}`);
      } finally {
        setIsFetchingTests(false);
      }
    };
    fetchTests();
  }, []);

  const handleCreateTest = async (inputValue) => {
    if (!inputValue.trim()) {
      toast.error('Test name cannot be empty');
      return;
    }
    setIsCreatingTests(true);
    try {
      const payload = {
        test_name: inputValue,
        test_notes: 'Created via UI',
      };
      const response = await axios.post(`${BASE_URL}/api/tests`, payload, {
      });
      const newTest = {
        value: String(response.data.id), // Use id from server
        label: response.data.test_name,
      };
      setTests((prev) => [...prev, newTest]);
      onTestsChange([...selectedTests, newTest.value]);
      toast.success(`Test "${inputValue}" created successfully`);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      toast.error(`Failed to create test: ${errorMsg}`);
    } finally {
      setIsCreatingTests(false);
    }
  };

  const handleSearchTests = useCallback(
    debounce(async (inputValue) => {
      if (!inputValue || inputValue.length < 2) {
        setIsSearchingTests(false);
        return;
      }
      setIsSearchingTests(true);
      try {
        const response = await axios.get(
          `${BASE_URL}/api/tests?search=${encodeURIComponent(inputValue)}`
        );
        setTests(
          response.data.map((test) => ({
            value: String(test.id),
            label: test.test_name,
          }))
        );
      } catch (error) {
        toast.error(`Failed to search tests: ${error.response?.data?.error || error.message}`);
      } finally {
        setIsSearchingTests(false);
      }
    }, 500),
    []
  );

  const customStyles = {
    control: (base) => ({
      ...base,
      borderRadius: '12px',
      padding: '8px 12px',
      borderColor: '#e5e7eb',
      boxShadow: 'none',
      '&:hover': { borderColor: '#d1d5db' },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: '#fff7ed',
      borderRadius: '8px',
      padding: '2px 8px',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: '#ea580c',
      fontWeight: '500',
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? '#fff7ed' : 'white',
      color: state.isFocused ? '#ea580c' : '#1f2937',
      fontWeight: state.isFocused ? '500' : '400',
    }),
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="bg-orange-600 p-3 rounded-xl text-white shadow-md hover:shadow-lg transition-shadow duration-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">
            Diagnostic Tests
          </h3>
          <p className="text-sm text-gray-500 mt-1 font-medium tracking-wide">
            Select or create laboratory investigations
          </p>
        </div>
      </div>

      {isFetchingTests || isCreatingTests ? (
        <Loader
          message={isCreatingTests ? 'Creating test...' : 'Loading tests...'}
          color="orange-600"
        />
      ) : (
        <CreatableSelect
          isMulti
          options={tests}
          value={selectedTests.map((test) => ({
            value: test,
            label:
              tests.find((t) => t.value === test)?.label ||
              test, // Fallback to test if not found
          }))}
          onChange={(selectedOptions) =>
            onTestsChange(
              selectedOptions ? selectedOptions.map((opt) => opt.value) : []
            )
          }
          onCreateOption={handleCreateTest}
          onInputChange={(inputValue, { action }) => {
            if (action === 'input-change') {
              handleSearchTests(inputValue);
            }
          }}
          placeholder="Search or create tests..."
          className="react-select-container"
          classNamePrefix="react-select"
          isClearable
          isLoading={isSearchingTests}
          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
          styles={customStyles}
        />
      )}
    </div>
  );
};

export default DiagnosticTestsSection;