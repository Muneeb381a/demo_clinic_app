import React from 'react';

const NewPatientForm = ({ newPatient, setNewPatient, createPatient, loading, error }) => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold mb-4">New Patient Registration</h2>
    {/* Form fields */}
    <button
      className="mt-4 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
      onClick={createPatient}
      disabled={loading}
    >
      {loading ? 'Saving...' : 'Save Patient'}
    </button>
    {error && <div className="text-red-500 mt-2">{error}</div>}
  </div>
);

export default NewPatientForm;