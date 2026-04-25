import React from 'react';
import { useSelector } from 'react-redux';
import { selectNeuroOptions } from '../store/slices/appDataSlice';
import NeuroExamSelect from './NeuroExamSelect';

const defaultFields = [
  'motor_function',
  'muscle_tone',
  'muscle_strength',
  'straight_leg_raise_left',
  'straight_leg_raise_right',
  'deep_tendon_reflexes',
  'plantar_reflex',
  'cranial_nerves',
  'gait_assessment', // Fixed from 'gait' to match initialized data
  'pupillary_reaction',
  'speech_assessment',
  'coordination',
  'sensory_examination',
  'mental_status',
  'cerebellar_function',
  'muscle_wasting',
  'abnormal_movements',
  'romberg_test',
  'nystagmus',
  'fundoscopy',
];

const NeurologicalExamSection = ({
  neuroExamData = {},
  setNeuroExamData,
  fields = defaultFields,
}) => {
  // Use preloaded Redux data (fetched once at login in AppShell) to avoid
  // 20 individual API calls per render. Convert format: {value:id, label:text}
  // → {label:text, value:text} so the stored value is always the text string.
  const reduxNeuroOptions = useSelector(selectNeuroOptions);
  const neuroOptionsByField = React.useMemo(() => {
    const result = {};
    for (const [field, opts] of Object.entries(reduxNeuroOptions)) {
      result[field] = (opts || []).map((opt) => ({ label: opt.label, value: opt.label }));
    }
    return result;
  }, [reduxNeuroOptions]);

  const initializedNeuroData = {
    // Select fields
    motor_function: '',
    muscle_tone: '',
    muscle_strength: '',
    straight_leg_raise_left: '',
    straight_leg_raise_right: '',
    deep_tendon_reflexes: '',
    plantar_reflex: '',
    cranial_nerves: '',
    gait_assessment: '',
    pupillary_reaction: '',
    speech_assessment: '',
    coordination: '',
    sensory_examination: '',
    mental_status: '',
    cerebellar_function: '',
    muscle_wasting: '',
    abnormal_movements: '',
    romberg_test: '',
    nystagmus: '',
    fundoscopy: '',
    // Checkboxes
    pain_sensation: false,
    vibration_sense: false,
    proprioception: false,
    temperature_sensation: false,
    brudzinski_sign: false,
    kernig_sign: false,
    facial_sensation: false,
    swallowing_function: false,
    // Scores
    mmse_score: '',
    gcs_score: '',
    nihss_score: '',
    // Textareas
    treatment_plan: '',
    power: '',
    findings: '', // Added for consistency, though not used in UI yet
    ...neuroExamData, // Merge with passed data
  };

  const handleFieldChange = (field, value) => {
    setNeuroExamData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="mb-5 text-lg font-bold text-gray-800 flex items-center gap-2">
        <span className="bg-purple-600 text-white p-2 rounded-lg">🧠</span>
        Neurological Examination
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
        {/* Neuro Exam Select Fields */}
        {fields.map((field) => {
          if (!defaultFields.includes(field)) {
            return null;
          }
          return (
            <NeuroExamSelect
              key={field}
              field={field}
              value={initializedNeuroData[field]}
              onChange={handleFieldChange}
              preloadedOptions={neuroOptionsByField[field]}
            />
          );
        })}

        <div className="md:col-span-4 space-y-4">
          <div className="w-full space-y-2">
            <label className="text-sm font-semibold text-gray-800">Power</label>
            <textarea
              value={initializedNeuroData.power || ''}
              onChange={(e) => handleFieldChange('power', e.target.value)}
              className="w-full px-4 py-3 text-base font-medium border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-500 focus:outline-none bg-white placeholder-gray-400"
              placeholder="write power"
              rows="3"
            />
          </div>
        </div>

        {/* Checkboxes */}
        {[
          { id: 'pain_sensation', label: 'Pain Sensation', desc: 'Assess response to sharp/dull stimuli' },
          { id: 'vibration_sense', label: 'Vibration Sensation', desc: 'Test with tuning fork' },
          { id: 'proprioception', label: 'Proprioception', desc: 'Joint position sense assessment' },
          { id: 'temperature_sensation', label: 'Temperature Sensation', desc: 'Test with warm/cold objects' },
          { id: 'brudzinski_sign', label: 'Brudzinski Sign', desc: 'Neck flexion causing hip flexion' },
          { id: 'kernig_sign', label: 'Kernig Sign', desc: 'Hip flexion with knee extension resistance' },
          { id: 'facial_sensation', label: 'Facial Sensation', desc: 'Test all three trigeminal branches' },
          { id: 'swallowing_function', label: 'Swallowing Function', desc: 'Assess cranial nerves IX and X' },
        ].map(({ id, label, desc }) => (
          <div key={id} className="my-3 group">
            <label
              htmlFor={id}
              className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 rounded-lg transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30"
            >
              <input
                id={id}
                type="checkbox"
                className="w-6 h-6 rounded-lg border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer dark:border-gray-600 dark:bg-gray-800 dark:checked:bg-blue-500 dark:checked:border-blue-500 transition-colors duration-200"
                checked={initializedNeuroData[id] || false}
                onChange={(e) => handleFieldChange(id, e.target.checked)}
              />
              <span className="text-base font-semibold text-black hover:text-gray-800 transition-colors duration-200">
                {label}
                <span className="block text-sm font-normal text-gray-500 dark:text-gray-400 mt-1">
                  {desc}
                </span>
              </span>
              <span className="w-3 h-3 rounded-full bg-blue-200 group-hover:bg-blue-300 ml-auto dark:bg-blue-900/40 dark:group-hover:bg-blue-900/60 transition-colors duration-200"></span>
            </label>
          </div>
        ))}

        {/* Scores */}
        <div className="flex flex-col md:flex-col gap-4 md:col-span-4 w-full">
          <h4 className="font-semibold text-gray-800 border-l-4 border-purple-500 pl-3 py-1.5">
            Additional Observations
          </h4>
          <div className="flex gap-6 md:col-span-4 w-full">
            {/* MMSE Score */}
            <div className="w-full space-y-2">
              <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span>MMSE Score</span>
                <span className="text-xs text-gray-500">(Mini-Mental State Examination)</span>
              </label>
              <div className="relative flex items-center gap-2 w-full">
                <input
                  type="text"
                  value={initializedNeuroData.mmse_score?.split('/')[0] || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                    handleFieldChange('mmse_score', value ? `${value}/30` : '');
                  }}
                  className="w-full px-4 py-3 text-base font-medium border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-500 focus:outline-none bg-white placeholder-gray-400"
                  placeholder="e.g., 24"
                />
                <span className="absolute right-3 text-gray-500 font-medium">/30</span>
              </div>
              {initializedNeuroData.mmse_score &&
                parseInt(initializedNeuroData.mmse_score.split('/')[0]) > 30 && (
                  <p className="text-red-600 text-sm font-medium mt-1 bg-red-50 px-2 py-1 rounded-md">
                    Score must not exceed 30
                  </p>
                )}
            </div>

            {/* GCS Score */}
            <div className="w-full space-y-2">
              <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span>GCS Score</span>
                <span className="text-xs text-gray-500">(Glasgow Coma Scale)</span>
              </label>
              <div className="relative flex items-center gap-2 w-full">
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={initializedNeuroData.gcs_score?.split('/')[0] || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (value >= 1 && value <= 15) {
                      handleFieldChange('gcs_score', `${value}/15`);
                    } else if (e.target.value === '') {
                      handleFieldChange('gcs_score', '');
                    }
                  }}
                  className="w-full pr-10 px-4 py-3 text-base font-medium border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-500 focus:outline-none bg-white placeholder-gray-400"
                  placeholder="1 to 15"
                />
                <span className="absolute right-3 text-gray-500 font-medium">/15</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Treatment Plan */}
        <div className="md:col-span-4 space-y-4">
          <h4 className="font-medium text-gray-700 bg-gray-50 p-2 rounded-lg">
            Additional Examination
          </h4>
          <div className="w-full space-y-2">
            <label className="text-sm font-semibold text-gray-800">Treatment Plan</label>
            <textarea
              value={initializedNeuroData.treatment_plan || ''}
              onChange={(e) => handleFieldChange('treatment_plan', e.target.value)}
              className="w-full px-4 py-3 text-base font-medium border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-500 focus:outline-none bg-white placeholder-gray-400"
              placeholder="Enter treatment plan..."
              rows="3"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeurologicalExamSection;