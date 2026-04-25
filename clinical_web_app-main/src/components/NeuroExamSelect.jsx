import React, { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import axios from '../utils/axiosClient';

const fieldLabelMap = {
  motor_function: 'Motor Functions',
  muscle_tone: 'Muscle Tone',
  muscle_strength: 'Muscle Strength',
  straight_leg_raise_left: 'SLR-Left',
  straight_leg_raise_right: 'SLR-Right',
  deep_tendon_reflexes: 'Reflexes',
  plantar_reflex: 'Plantar',
  cranial_nerves: 'Cranial Nerves',
  gait_assessment: 'Gait & Balance', // Fixed from 'gait'
  pupillary_reaction: 'Pupillary Reaction',
  speech_assessment: 'Speech Assessment',
  coordination: 'Coordination',
  sensory_examination: 'Sensory Examination',
  mental_status: 'Mental Status',
  cerebellar_function: 'Cerebellar Function',
  muscle_wasting: 'Muscle Wasting',
  abnormal_movements: 'Abnormal Movements',
  romberg_test: 'Romberg Test',
  nystagmus: 'Nystagmus',
  fundoscopy: 'Fundoscopy',
};

const fieldColors = {
  motor_function: '#3b82f6', // Blue
  muscle_tone: '#10b981', // Emerald
  muscle_strength: '#f59e0b', // Amber
  straight_leg_raise_left: '#8b5cf6', // Violet
  straight_leg_raise_right: '#8b5cf6', // Violet
  deep_tendon_reflexes: '#ef4444', // Red
  plantar_reflex: '#ec4899', // Pink
  cranial_nerves: '#14b8a6', // Teal
  gait_assessment: '#f97316', // Orange (Fixed from 'gait')
  pupillary_reaction: '#06b6d4', // Cyan
  speech_assessment: '#84cc16', // Lime
  coordination: '#a855f7', // Purple
  sensory_examination: '#22c55e', // Green
  mental_status: '#eab308', // Yellow
  cerebellar_function: '#0ea5e9', // Sky Blue
  muscle_wasting: '#d946ef', // Fuchsia
  abnormal_movements: '#64748b', // Slate
  romberg_test: '#3b82f6', // Blue
  nystagmus: '#d946ef', // Fuchsia
  fundoscopy: '#64748b', // Slate
  default: '#3b82f6', // Default color
};

const NeuroExamSelect = ({ field, value, onChange, preloadedOptions }) => {
  const [options, setOptions] = useState(preloadedOptions || []);
  const [loading, setLoading] = useState(!preloadedOptions);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const fieldColor = fieldColors[field] || fieldColors.default;

  useEffect(() => {
    // Skip API call when parent already provided options from Redux
    if (preloadedOptions) {
      setOptions(preloadedOptions);
      setLoading(false);
      return;
    }
    const loadOptions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(
          `/api/neuro-options/${field}`,
        );
        const responseData = response.data.data || response.data;

        if (!Array.isArray(responseData)) {
          throw new Error('Expected an array of options, but received: ' + typeof responseData);
        }

        const formattedOptions = responseData.map((item) => ({
          label: item.value,
          value: item.value,
        }));
        setOptions(formattedOptions);
      } catch (err) {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [field, preloadedOptions]);

  const handleChange = (selectedOption) => {
    onChange(field, selectedOption?.value || '');
  };

  const handleCreate = async (inputValue) => {
    setIsCreating(true);
    try {
      const { data } = await axios.post(
        `/api/neuro-options/${field}`,
        { value: inputValue },
      );

      const newOption = { label: data.data.value, value: data.data.value };
      setOptions((prev) => [...prev, newOption]);
      onChange(field, newOption.value);
    } catch (error) {
      alert('Failed to add custom option. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mb-6">
      <label className="block mb-2 text-sm text-gray-700 font-[500]">
        {fieldLabelMap[field] || field.replace(/_/g, ' ')}
      </label>
      <CreatableSelect
        isClearable
        isLoading={loading || isCreating}
        options={options}
        value={value ? { label: value, value } : null}
        onChange={handleChange}
        onCreateOption={handleCreate}
        placeholder="Select or create option..."
        noOptionsMessage={() => 'Type to create new option'}
        loadingMessage={() => (
          <div className="flex items-center gap-2">
            <div className="bouncing-loader">
              {[...Array(3)].map((_, i) => (
                <span
                  key={i}
                  style={{ backgroundColor: fieldColor }}
                  className="h-2 w-2 rounded-full animate-bounce"
                />
              ))}
            </div>
            <span className="text-gray-500">Loading options...</span>
          </div>
        )}
        styles={{
          control: (base) => ({
            ...base,
            borderRadius: '0.75rem',
            padding: '8px 12px',
            borderWidth: '2px',
            borderColor: '#e5e7eb',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: '#9ca3af',
              boxShadow: `0 1px 3px ${fieldColor}20`,
            },
            '&:focus-within': {
              borderColor: fieldColor,
              boxShadow: `0 0 0 3px ${fieldColor}20`,
            },
          }),
          indicatorSeparator: (base) => ({
            ...base,
            backgroundColor: '#e5e7eb',
          }),
          dropdownIndicator: (base) => ({
            ...base,
            color: '#6b7280',
            '&:hover': { color: '#374151' },
          }),
          option: (base, { isFocused }) => ({
            ...base,
            backgroundColor: isFocused ? `${fieldColor}10` : 'white',
            color: isFocused ? fieldColor : '#1f2937',
            fontWeight: isFocused ? '500' : '400',
            ':active': {
              backgroundColor: `${fieldColor}20`,
            },
          }),
          menu: (base) => ({
            ...base,
            borderRadius: '0.75rem',
            border: '2px solid #f3f4f6',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginTop: '8px',
          }),
          singleValue: (base) => ({
            ...base,
            color: fieldColor,
            fontWeight: '500',
          }),
          placeholder: (base) => ({
            ...base,
            color: '#9ca3af',
            fontSize: '0.875rem',
          }),
        }}
        components={{
          LoadingIndicator: () => (
            <div
              className="animate-spin h-4 w-4 border-2 border-current rounded-full mr-2"
              style={{
                borderTopColor: 'transparent',
                color: fieldColor,
              }}
            />
          ),
        }}
        aria-label={`Select ${fieldLabelMap[field]} option`}
        aria-describedby={`${field}-help`}
      />
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default NeuroExamSelect;