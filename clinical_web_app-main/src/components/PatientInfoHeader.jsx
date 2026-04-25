import React from 'react';
import { AiOutlineArrowLeft, AiOutlineHistory, AiOutlineUser } from 'react-icons/ai';
import PatientHistoryModal from "./PatientHistoryModal"

const PatientInfoHeader = ({ patient, onReturnHome, prescriptions, setShowPopup }) => (
  <div className="mb-8 rounded-2xl overflow-hidden shadow-lg border border-gray-100">
    {/* Top nav bar */}
    <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-700">
      <button
        onClick={onReturnHome}
        className="group flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-x-0.5"
      >
        <AiOutlineArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
        Back to Search
      </button>

      <div className="flex items-center gap-3">
        {Array.isArray(prescriptions) && prescriptions.length > 0 && (
          <button
            onClick={() => setShowPopup(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105 text-sm"
          >
            <AiOutlineHistory className="w-4 h-4" />
            Previous Prescriptions
          </button>
        )}
        {patient?.id ? (
          <PatientHistoryModal patientId={patient.id} />
        ) : (
          <p className="text-white/60 italic text-sm">No patient selected</p>
        )}
      </div>
    </div>

    {/* Patient info card */}
    <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-5 flex items-center gap-5">
      <div className="bg-white/20 p-3 rounded-2xl shadow-inner">
        <AiOutlineUser className="w-8 h-8 text-white" />
      </div>
      <div className="flex-1">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">{patient.name}</h2>
        <div className="flex items-center gap-4 mt-1">
          <span className="flex items-center gap-1 text-teal-100 text-sm">
            <span className="text-white/60 text-xs">ID</span>
            <span className="bg-white/20 text-white font-bold px-2 py-0.5 rounded-lg text-xs">{patient.id}</span>
          </span>
          {patient.mobile && (
            <span className="flex items-center gap-1 text-teal-100 text-sm">
              <span className="text-white/60 text-xs">📞</span>
              <span className="font-medium">{patient.mobile}</span>
            </span>
          )}
          {patient.age && (
            <span className="text-teal-100 text-sm">
              <span className="text-white/60 text-xs">Age: </span>
              <span className="font-medium">{patient.age}</span>
            </span>
          )}
          {patient.gender && (
            <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full capitalize">
              {patient.gender}
            </span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
        <span className="text-white/70 text-xs">Today</span>
        <span className="text-white font-bold text-sm">
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  </div>
);

export default PatientInfoHeader;