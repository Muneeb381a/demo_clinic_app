
import React, { lazy, Suspense } from "react";
import SymptomAnalysisSection from "./SymptomAnalysisSection";
const NeurologicalExamSection = lazy(() => import("./NeurologicalExamSection"));
import DiagnosisTestSection from "./DiagnosisTestSection";
import PrescriptionManagementSection from "./PrescriptionManagementSection";
import VitalSignsSection from "./VitalSignsSection";
import FollowUpSection from "./FollowUpSection";
import MedicalChatbot from "./MedicalChatbot";
import SimilarCasesPanel from "./SimilarCasesPanel";

const ConsultationForm = ({
  vitalSigns,
  onVitalSignsChange,
  selectedSymptoms,
  onSymptomsChange,
  neuroExamData,
  setNeuroExamData,
  neuroExamFields,
  tests,
  selectedTests,
  onTestsChange,
  loading,
  selectedMedicines,
  setSelectedMedicines,
  customSelectStyles,
  selectedDuration,
  followUpDate,
  followUpNotes,
  onDurationChange,
  onDateChange,
  onNotesChange,
  onSubmit,
  onPrint,
  medicines,
  symptomsOptions,
  refreshMedicines,
}) => {
  // Validation is handled upstream in PatientConsultation before onSubmit/onPrint
  // are called — no need to duplicate it here.
  const handleSubmit = async () => {
    if (loading) return;
    await onSubmit();
  };

  const handlePrint = () => {
    if (loading) return;
    onPrint();
  };

  return (
    <div className="space-y-8" id="consultation-content">
      <MedicalChatbot
        medicines={medicines}
        symptomsOptions={symptomsOptions}
        tests={tests}
        selectedMedicines={selectedMedicines}
        setSelectedMedicines={setSelectedMedicines}
        selectedSymptoms={selectedSymptoms}
        onSymptomsChange={onSymptomsChange}
        selectedTests={selectedTests}
        onTestsChange={onTestsChange}
        setNeuroExamData={setNeuroExamData}
      />
      <VitalSignsSection
        vitalSigns={vitalSigns}
        onVitalSignsChange={onVitalSignsChange}
      />
      <SymptomAnalysisSection
        selectedSymptoms={selectedSymptoms}
        onSymptomsChange={onSymptomsChange}
        symptomsOptions={symptomsOptions}
        setSelectedMedicines={setSelectedMedicines}
        setSelectedTests={onTestsChange}
        medicines={medicines}
      />
      <SimilarCasesPanel
        selectedSymptoms={selectedSymptoms}
        symptomsOptions={symptomsOptions}
        medicines={medicines}
        setSelectedMedicines={setSelectedMedicines}
        setNeuroExamData={setNeuroExamData}
        onSymptomsChange={onSymptomsChange}
      />
      <Suspense fallback={<div className="h-24 rounded-2xl bg-gray-50 animate-pulse" />}>
        <NeurologicalExamSection
          neuroExamData={neuroExamData}
          setNeuroExamData={setNeuroExamData}
          fields={neuroExamFields}
        />
      </Suspense>
      <DiagnosisTestSection
        tests={tests}
        selectedTests={selectedTests}
        onTestsChange={onTestsChange}
        isLoading={loading}
      />
      <PrescriptionManagementSection
        selectedMedicines={selectedMedicines}
        setSelectedMedicines={setSelectedMedicines}
        customSelectStyles={customSelectStyles}
        medicines={medicines}
        refreshMedicines={refreshMedicines}
      />
      <div className="md:col-span-4 space-y-4">
        <h4 className="font-medium text-gray-700 bg-gray-50 p-2 rounded-lg">
          Clinical Decisions
        </h4>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Diagnosis</label>
          <textarea
            value={neuroExamData.diagnosis || ""}
            onChange={(e) =>
              setNeuroExamData((prev) => ({
                ...prev,
                diagnosis: e.target.value,
              }))
            }
            className="w-full rounded-lg border-2 border-gray-100 p-3 h-32"
          />
        </div>
      </div>
      <FollowUpSection
        selectedDuration={selectedDuration}
        followUpDate={followUpDate}
        followUpNotes={followUpNotes}
        onDurationChange={onDurationChange}
        onDateChange={onDateChange}
        onNotesChange={onNotesChange}
      />
      {/* Action buttons */}
      <div className="space-y-3 pt-2">
        {/* Primary Save button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-lg ${
            loading
              ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 hover:shadow-xl hover:scale-[1.02] active:scale-[0.99]"
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Saving consultation...</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Save Consultation</span>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-medium">+ Print</span>
            </>
          )}
        </button>

        {/* Print-only button */}
        <button
          onClick={handlePrint}
          disabled={loading}
          className={`w-full py-3.5 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 border-2 transition-all duration-200 cursor-pointer print:hidden ${
            loading
              ? "border-gray-200 text-gray-300 cursor-not-allowed"
              : "border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
          </svg>
          Print Prescription Only
        </button>
      </div>
    </div>
  );
};

export default ConsultationForm;