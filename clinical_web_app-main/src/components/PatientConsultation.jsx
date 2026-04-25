import React, { useState, useEffect, useCallback, useMemo, Component } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import PatientInfoHeader from "./PatientInfoHeader";
import ConsultationForm from "./ConsultationForm";
import PrescriptionsPopup from "./PrescriptionsPopup";
import printConsultation from "../utils/printConsultation";
import { fetchWithRetry } from "../utils/api";
import { Loader } from "../pages/Loader";
import {
  invalidateMedicines,
  fetchMedicines,
  selectSymptoms,
  selectTests,
  selectMedicines,
  selectNeuroOptions,
  selectAppDataLoading,
} from "../store/slices/appDataSlice";
import { invalidateDashboard } from "../store/slices/dashboardSlice";

const neuroExamFields = [
  "motor_function",
  "muscle_tone",
  "muscle_strength",
  "straight_leg_raise_left",
  "straight_leg_raise_right",
  "deep_tendon_reflexes",
  "plantar_reflex",
  "pupillary_reaction",
  "speech_assessment",
  "gait_assessment",
  "coordination",
  "sensory_examination",
  "cranial_nerves",
  "mental_status",
  "cerebellar_function",
  "muscle_wasting",
  "abnormal_movements",
  "romberg_test",
  "nystagmus",
  "fundoscopy",
];


// Fetches only the patient record (shared static data now comes from Redux store)
const fetchPatient = async (patientId) => {
  const data = await fetchWithRetry(
    "get",
    `/api/patients/${patientId}`,
    `patient:${patientId}`,
    null,
    (d) => {
      if (!d || !d.id) throw new Error("Invalid patient data");
      return { id: d.id, name: d.name || "Unknown", mobile: d.mobile || "", age: d.age || null, gender: d.gender || null };
    }
  );
  return data;
};
// Custom error boundary without external package
class CustomErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center flex-col">
          <p className="text-lg text-red-600">
            Error: {this.state.error.message}
          </p>
          <button
            onClick={() => this.props.navigate("/")}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PatientConsultation = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // ── Redux store — shared static data ───────────────────────────────────────
  const symptomsOptions = useSelector(selectSymptoms);
  const tests = useSelector(selectTests);
  const medicines = useSelector(selectMedicines);
  const neuroOptions = useSelector(selectNeuroOptions);
  const appLoading = useSelector(selectAppDataLoading);

  // ── Local state — patient-specific ─────────────────────────────────────────
  const [patient, setPatient] = useState(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [neuroExamData, setNeuroExamData] = useState({});
  const [followUpDate, setFollowUpDate] = useState(null);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [vitalSigns, setVitalSigns] = useState({
    pulseRate: "",
    bloodPressure: "",
    temperature: "",
    spo2: "",
    nihss: "",
    fall_assessment: "Done",
  });
  const [fetchError, setFetchError] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(false);

  const customSelectStyles = useMemo(() => ({
    control: (base) => ({
      ...base,
      borderColor: "#ccc",
      boxShadow: "none",
      padding: "2px 2px",
      minHeight: "45px",
      display: "flex",
      alignItems: "center",
      "&:hover": { borderColor: "#888" },
    }),
    option: (provided, state) => ({
      ...provided,
      padding: "12px 15px",
      display: "flex",
      alignItems: "center",
      backgroundColor: state.isSelected ? "#4CAF50" : "#fff",
      color: state.isSelected ? "#fff" : "#333",
      "&:hover": { backgroundColor: "#f1f1f1" },
    }),
  }), []);

  // Force-refresh medicines in the Redux store (called before submit/print to validate)
  const refreshMedicines = useCallback(async () => {
    dispatch(invalidateMedicines());
    await dispatch(fetchMedicines(true));
    const validIds = medicines.map((m) => m.value);
    const invalid = selectedMedicines.filter(
      (med) => med.medicine_id && !validIds.includes(String(med.medicine_id))
    );
    if (invalid.length > 0) {
      toast.warn(`Removed unrecognized medicines. Please reselect.`);
      setSelectedMedicines((prev) =>
        prev.filter((med) => validIds.includes(String(med.medicine_id)))
      );
    }
  }, [dispatch, medicines, selectedMedicines]);

  // Load patient-specific data
  useEffect(() => {
    if (!patientId) {
      setFetchError("No patient ID provided");
      setLoading(false);
      toast.error("No patient ID provided. Please select a patient.");
      return;
    }
    setLoading(true);
    setFetchError(null);
    fetchPatient(patientId)
      .then(setPatient)
      .catch((err) => {
        const msg = err.message?.includes("404")
          ? "Patient not found."
          : `Failed to load patient: ${err.message}`;
        setFetchError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  // Pre-fill form when navigated with cloned consultation data
  useEffect(() => {
    const cloned = location.state?.clonedConsultation;
    if (!cloned || appLoading.medicines || appLoading.symptoms) return;

    // Map medicines from prescriptions (already have medicine_id + dosage data)
    if (Array.isArray(cloned.prescriptions) && cloned.prescriptions.length > 0) {
      const mappedMeds = cloned.prescriptions
        .filter((p) => p.medicine_id)
        .map((p) => ({
          medicine_id: p.medicine_id,
          dosage_en: p.dosage_en || "",
          dosage_urdu: p.dosage_urdu || "",
          frequency_en: p.frequency_en || "",
          frequency_urdu: p.frequency_urdu || "",
          duration_en: p.duration_en || "",
          duration_urdu: p.duration_urdu || "",
          instructions_en: p.instructions_en || "",
          instructions_urdu: p.instructions_urdu || "",
          how_to_take_en: p.how_to_take_en || null,
          how_to_take_urdu: p.how_to_take_urdu || null,
        }));
      if (mappedMeds.length > 0) setSelectedMedicines(mappedMeds);
    }

    // Map tests: DiagnosisTestSection expects an array of string IDs
    if (Array.isArray(cloned.tests) && cloned.tests.length > 0) {
      const mappedTests = cloned.tests
        .filter((t) => t.test_id)
        .map((t) => String(t.test_id));
      if (mappedTests.length > 0) setSelectedTests(mappedTests);
    }

    // Map symptoms: match names back to IDs from Redux store
    if (Array.isArray(cloned.symptoms) && cloned.symptoms.length > 0 && symptomsOptions.length > 0) {
      const nameSet = new Set(cloned.symptoms.map((n) => n?.toLowerCase()));
      const mappedSymptoms = symptomsOptions.filter((s) =>
        nameSet.has(s.label?.toLowerCase())
      );
      if (mappedSymptoms.length > 0) setSelectedSymptoms(mappedSymptoms);
    }

    if (cloned.prescriptions?.length > 0 || cloned.tests?.length > 0 || cloned.symptoms?.length > 0) {
      toast.info("Previous prescription loaded. Review and adjust as needed.");
    }
  }, [location.state, appLoading.medicines, appLoading.symptoms, symptomsOptions]);



  const handlePrint = () => {
    if (selectedMedicines.length === 0) {
      toast.warn("No medicines selected to print.");
      return;
    }

    // Validate inline against already-loaded medicines — no network call needed
    const validIds = medicines.map((m) => String(m.value));
    const invalidMedicines = selectedMedicines.filter(
      (med) => med.medicine_id && !validIds.includes(String(med.medicine_id))
    );
    if (invalidMedicines.length > 0) {
      toast.error(
        `Cannot print: Unrecognized medicines (IDs: ${invalidMedicines
          .map((m) => m.medicine_id)
          .join(", ")}). Please reselect.`
      );
      return;
    }

    try {
      printConsultation({
        patient,
        selectedMedicines,
        medicines,
        vitalSigns,
        selectedTests,
        tests,
        selectedSymptoms,
        neuroExamData,
        followUpDate,
        followUpNotes,
      });
    } catch (error) {
      toast.error("Failed to print consultation. Please try again.");
    }
  };

  const submitConsultation = async () => {
    if (!patient || !patient.id) {
      toast.error("Patient data is missing or invalid.");
      return;
    }
    if (submissionLoading) {
      toast.warn("Please wait for the ongoing submission to complete.");
      return;
    }
    if (!navigator.onLine) {
      setPendingSubmission(true);
      toast.warn("Offline. Please reconnect and try again.");
      return;
    }

    // Inline validation before sending
    const validIds = medicines.map((m) => String(m.value));
    const invalidMedicines = selectedMedicines.filter(
      (med) => med.medicine_id && !validIds.includes(String(med.medicine_id))
    );
    if (invalidMedicines.length > 0) {
      toast.error(
        `Cannot submit: Unrecognized medicines (IDs: ${invalidMedicines.map((m) => m.medicine_id).join(", ")}). Please reselect.`
      );
      return;
    }

    setSubmissionLoading(true);

    try {
      // Build the single batch payload
      const payload = {
        patient_id: Number(patient.id),
        doctor_name: "Dr. Abdul Rauf",
        visit_date: new Date().toISOString(),
      };

      // Vitals
      if (Object.values(vitalSigns).some((v) => v !== "" && v !== null)) {
        payload.vitals = {
          pulse_rate: Number(vitalSigns.pulseRate) || null,
          blood_pressure: vitalSigns.bloodPressure?.trim() || null,
          temperature: Number(vitalSigns.temperature) || null,
          spo2_level: Number(vitalSigns.spo2) || null,
          nihss_score: Number(vitalSigns.nihss) || null,
          fall_assessment: vitalSigns.fall_assessment || "Done",
        };
      }

      // Symptoms
      if (Array.isArray(selectedSymptoms) && selectedSymptoms.length > 0) {
        const validSymptomIds = symptomsOptions.map((s) => String(s.value));
        payload.symptom_ids = selectedSymptoms
          .map((s) => s?.value && Number(s.value))
          .filter((id) => id && validSymptomIds.includes(String(id)));
      }

      // Medicines — filter out any entry with invalid/zero medicine_id
      if (Array.isArray(selectedMedicines) && selectedMedicines.length > 0) {
        const validMeds = selectedMedicines.filter(
          (med) => med.medicine_id && Number(med.medicine_id) > 0
        );
        if (validMeds.length > 0) {
          payload.medicines = validMeds.map((med) => ({
            medicine_id: Number(med.medicine_id),
            dosage_en: med.dosage_en ? String(med.dosage_en).trim() : "",
            dosage_urdu: med.dosage_urdu?.trim() || "",
            frequency_en: med.frequency_en?.trim() || "",
            frequency_urdu: med.frequency_urdu?.trim() || "",
            duration_en: med.duration_en?.trim() || "",
            duration_urdu: med.duration_urdu?.trim() || "",
            instructions_en: med.instructions_en?.trim() || "",
            instructions_urdu: med.instructions_urdu?.trim() || "",
            how_to_take_en: med.how_to_take_en?.trim() || null,
            how_to_take_urdu: med.how_to_take_urdu?.trim() || null,
          }));
        }
      }

      // Tests
      if (Array.isArray(selectedTests) && selectedTests.length > 0) {
        payload.test_ids = selectedTests
          .map((t) => t && typeof t === "object" ? Number(t.value) : Number(t))
          .filter((id) => !isNaN(id) && id > 0);
      }

      // Neuro Exam
      if (neuroExamData && Object.keys(neuroExamData).length > 0) {
        payload.neuro = {
          ...neuroExamData,
          pain_sensation: !!neuroExamData.pain_sensation,
          vibration_sense: !!neuroExamData.vibration_sense,
          proprioception: !!neuroExamData.proprioception,
          temperature_sensation: !!neuroExamData.temperature_sensation,
          brudzinski_sign: !!neuroExamData.brudzinski_sign,
          kernig_sign: !!neuroExamData.kernig_sign,
          facial_sensation: !!neuroExamData.facial_sensation,
          swallowing_function: !!neuroExamData.swallowing_function,
          mmse_score: neuroExamData.mmse_score ? parseInt(neuroExamData.mmse_score) : null,
          gcs_score: neuroExamData.gcs_score ? parseInt(neuroExamData.gcs_score) : null,
        };
      }

      // Follow-Up
      if (selectedDuration && followUpDate instanceof Date && !isNaN(followUpDate) && Number(selectedDuration) > 0) {
        payload.follow_up = {
          follow_up_date: followUpDate.toISOString().split("T")[0],
          notes: followUpNotes?.trim() || "General check-up",
        };
      }

      // Single API call — saves everything in one DB transaction
      await fetchWithRetry("post", "/api/consultations/complete", "save-consultation", payload, (data) => data);

      toast.success("Consultation saved successfully!");

      // Reset form state
      setVitalSigns({ pulseRate: "", bloodPressure: "", temperature: "", spo2: "", nihss: "", fall_assessment: "Done" });
      setFollowUpDate(null);
      setFollowUpNotes("");
      setSelectedDuration(null);

      // Print before navigating
      try { handlePrint(); } catch {}

      // Bust stale caches
      try {
        sessionStorage.removeItem(`fc:patient-history:${patientId}`);
        sessionStorage.removeItem("fc:dashboard-stats");
      } catch {}
      dispatch(invalidateDashboard());

      navigate("/");
    } catch (error) {
      console.error("Consultation save failed:", error.response?.data || error.message);
      let errorMessage =
        error.response?.data?.details ||
        error.response?.data?.message ||
        error.message ||
        "Submission error";
      if (error.code === "ECONNABORTED") errorMessage = "Request timed out. Please check your network.";
      else if (error.response?.status >= 500) errorMessage = "Server error. Please try again later.";
      else if (error.response?.status === 400) errorMessage = `Invalid data: ${error.response?.data?.details || error.response?.data?.message || "Check your inputs."}`;
      toast.error(errorMessage);
    } finally {
      setSubmissionLoading(false);
    }
  };

  return (
    <CustomErrorBoundary navigate={navigate}>
      <div className="min-h-screen p-8 relative overflow-hidden isolate w-[90vw] mx-auto before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_transparent)] before:opacity-50 before:-z-10">
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/30 bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-gray-100/30">
          <div className="mb-6 pb-4 border-b border-gray-100 flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-3 rounded-2xl shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">New Consultation</h2>
              <p className="text-sm text-gray-500">Fill in the details below and click <strong>Save Consultation</strong> when done</p>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-2 text-sm text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          {loading || appLoading.medicines || appLoading.symptoms ? (
            <div className="min-h-screen flex items-center justify-center">
              <Loader message="Loading consultation..." />
            </div>
          ) : fetchError ? (
            <div className="flex items-center justify-center flex-col">
              <p className="text-lg text-red-600">{fetchError}</p>
              <button
                onClick={() => navigate("/")}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
              >
                Return to Home
              </button>
            </div>
          ) : patient ? (
            <>
              <PatientInfoHeader
                patient={patient}
                onReturnHome={() => navigate("/")}
                setShowPopup={setShowPopup}
              />
              <ConsultationForm
                vitalSigns={vitalSigns}
                onVitalSignsChange={setVitalSigns}
                selectedSymptoms={selectedSymptoms}
                onSymptomsChange={setSelectedSymptoms}
                neuroExamData={neuroExamData}
                setNeuroExamData={setNeuroExamData}
                neuroExamFields={neuroExamFields}
                neuroOptions={neuroOptions}
                tests={tests}
                selectedTests={selectedTests}
                onTestsChange={setSelectedTests}
                loading={submissionLoading}
                selectedMedicines={selectedMedicines}
                setSelectedMedicines={setSelectedMedicines}
                customSelectStyles={customSelectStyles}
                selectedDuration={selectedDuration}
                followUpDate={followUpDate}
                followUpNotes={followUpNotes}
                onDurationChange={setSelectedDuration}
                onDateChange={setFollowUpDate}
                onNotesChange={setFollowUpNotes}
                onSubmit={submitConsultation}
                onPrint={handlePrint}
                medicines={medicines}
                symptomsOptions={symptomsOptions}
                refreshMedicines={refreshMedicines}
              />
              {showPopup && (
                <PrescriptionsPopup
                  prescriptions={prescriptions}
                  onClose={() => setShowPopup(false)}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center flex-col">
              <p className="text-lg text-red-600">
                No patient data loaded. Please try again or return home.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
              >
                Return to Home
              </button>
            </div>
          )}
        </div>
        <ToastContainer />
      </div>
    </CustomErrorBoundary>
  );
};

export default PatientConsultation;
