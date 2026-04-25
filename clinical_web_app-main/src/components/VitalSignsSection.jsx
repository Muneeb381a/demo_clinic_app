import React from 'react';

const vitalsConfig = [
  { key: 'bloodPressure', label: 'Blood Pressure', hint: 'e.g. 120/80',    placeholder: '120/80', unit: 'mmHg', type: 'text',   icon: '🫀', color: 'red'    },
  { key: 'pulseRate',     label: 'Pulse Rate',     hint: 'Normal: 60–100', placeholder: '72',     unit: 'bpm',  type: 'number', min: 0,              icon: '💓', color: 'pink'   },
  { key: 'temperature',  label: 'Temperature',    hint: 'Normal: 36–37°C',placeholder: '36.6',   unit: '°C',   type: 'number', step: '0.1', min: 30, max: 45, icon: '🌡️', color: 'orange' },
  { key: 'spo2',         label: 'Oxygen Level',   hint: 'Normal: 95–100%',placeholder: '98',     unit: '%',    type: 'number', min: 0, max: 100,      icon: '🫁', color: 'blue'   },
  { key: 'nihss',        label: 'NIHSS Score',    hint: 'Stroke scale 0–42',placeholder:'0',     unit: '/42',  type: 'number', min: 0, max: 42,       icon: '🧠', color: 'purple' },
];

const colorMap = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    ring: 'focus:ring-red-400 focus:border-red-400',       icon: 'bg-red-100 text-red-600',       unit: 'text-red-500 border-red-200'       },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-200',   ring: 'focus:ring-pink-400 focus:border-pink-400',     icon: 'bg-pink-100 text-pink-600',     unit: 'text-pink-500 border-pink-200'     },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', ring: 'focus:ring-orange-400 focus:border-orange-400', icon: 'bg-orange-100 text-orange-600', unit: 'text-orange-500 border-orange-200' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'focus:ring-blue-400 focus:border-blue-400',     icon: 'bg-blue-100 text-blue-600',     unit: 'text-blue-500 border-blue-200'     },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', ring: 'focus:ring-purple-400 focus:border-purple-400', icon: 'bg-purple-100 text-purple-600', unit: 'text-purple-500 border-purple-200' },
};

const VitalSignsSection = ({ vitalSigns, onVitalSignsChange }) => {
  const handleChange = (field, value) => {
    onVitalSignsChange({ ...vitalSigns, [field]: value });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Vital Signs</h3>
          <p className="text-blue-100 text-sm">Record patient's current measurements</p>
        </div>
        <span className="ml-auto text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">Step 1</span>
      </div>

      <div className="p-6 space-y-4">
        {/* Vital inputs grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {vitalsConfig.map(({ key, label, hint, placeholder, unit, type, icon, color, ...rest }) => {
            const c = colorMap[color];
            return (
              <div key={key} className={`rounded-xl border-2 ${c.border} ${c.bg} p-3 transition-all duration-200 hover:shadow-md`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-base p-1.5 rounded-lg ${c.icon}`}>{icon}</span>
                  <span className={`text-xs font-semibold ${c.unit} bg-white px-2 py-0.5 rounded-full border`}>{unit}</span>
                </div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={vitalSigns[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className={`w-full px-3 py-2 bg-white border-2 ${c.border} rounded-lg text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 ${c.ring} transition-all`}
                  {...rest}
                />
                <p className="mt-1.5 text-xs text-gray-400">{hint}</p>
              </div>
            );
          })}
        </div>

        {/* Fall Assessment — toggle buttons */}
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl bg-green-100 text-green-600 p-2 rounded-lg">🛡️</span>
            <div>
              <p className="text-sm font-bold text-gray-700">Fall Risk Assessment</p>
              <p className="text-xs text-gray-500">Was fall risk assessment completed for this patient?</p>
            </div>
          </div>
          <div className="flex gap-2">
            {['Done', 'Not Done'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleChange('fall_assessment', opt)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-200 cursor-pointer ${
                  vitalSigns.fall_assessment === opt
                    ? opt === 'Done'
                      ? 'bg-green-600 border-green-600 text-white shadow-md scale-105'
                      : 'bg-red-500 border-red-500 text-white shadow-md scale-105'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600 hover:shadow-sm'
                }`}
              >
                {opt === 'Done' ? '✓ Done' : '✗ Not Done'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VitalSignsSection;