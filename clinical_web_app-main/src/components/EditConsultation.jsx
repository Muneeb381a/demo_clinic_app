import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ToastContainer, toast } from "react-toastify";
import PatientInfoHeader from "./PatientInfoHeader";
import ConsultationForm from "./ConsultationForm";
import printConsultation from "../utils/printConsultation";
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
import apiClient from "../utils/axiosClient";

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

const NEURO_KEYS = [
  "motor_function", "muscle_tone", "muscle_strength", "deep_tendon_reflexes",
  "plantar_reflex", "sensory_examination", "pain_sensation", "vibration_sense",
  "proprioception", "temperature_sensation", "coordination", "gait_assessment",
  "romberg_test", "cranial_nerves", "pupillary_reaction", "speech_assessment",
  "fundoscopy", "mmse_score", "gcs_score", "brudzinski_sign", "kernig_sign",
  "facial_sensation", "swallowing_function", "straight_leg_raise_left",
  "straight_leg_raise_right", "diagnosis", "treatment_plan", "notes", "power",
  "finger_nose_test", "heel_shin_test", "eye_movements", "tongue_movement",
  "straight_leg_raise_test", "lasegue_test", "cognitive_assessment",
  "tremors", "involuntary_movements",
];

const EditConsultation = () => {
  const { patientId, consultationId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // ── Redux store — shared static data ───────────────────────────────────────
  const symptomsOptions = useSelector(selectSymptoms);
  const tests = useSelector(selectTests);
  const medicines = useSelector(selectMedicines);
  const neuroOptions = useSelector(selectNeuroOptions);
  const appLoading = useSelector(selectAppDataLoading);

  // ── Local state ─────────────────────────────────────────────────────────────
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [neuroExamData, setNeuroExamData] = useState({});
  const [vitalSigns, setVitalSigns] = useState({
    pulseRate: "",
    bloodPressure: "",
    temperature: "",
    spo2: "",
    nihss: "",
    fall_assessment: "Done",
  });
  const [followUpDate, setFollowUpDate] = useState(null);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(null);

  // Symptom names from the loaded consultation — matched against Redux options
  const [pendingSymptomNames, setPendingSymptomNames] = useState([]);

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

  const refreshMedicines = useCallback(async () => {
    dispatch(invalidateMedicines());
    await dispatch(fetchMedicines(true));
  }, [dispatch]);

  // Load consultation data from new backend
  useEffect(() => {
    if (!patientId || !consultationId) return;

    const load = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await apiClient.get(
          `/api/patients/${patientId}/consultations/${consultationId}`
        );
        const data = res.data;

        // Patient info
        setPatient({
          id: data.patient_id,
          name: data.patient_name || "",
          mobile: data.mobile || "",
          age: data.age || null,
          gender: data.gender || null,
        });

        // Vitals — use first entry
        if (Array.isArray(data.vital_signs) && data.vital_signs.length > 0) {
          const v = data.vital_signs[0];
          setVitalSigns({
            pulseRate: v.pulse_rate ?? "",
            bloodPressure: v.blood_pressure ?? "",
            temperature: v.temperature ?? "",
            spo2: v.spo2_level ?? "",
            nihss: v.nihss_score ?? "",
            fall_assessment: v.fall_assessment ?? "Done",
          });
        }

        // Follow-up — use first entry
        if (Array.isArray(data.follow_ups) && data.follow_ups.length > 0) {
          const fu = data.follow_ups[0];
          if (fu.follow_up_date) {
            setFollowUpDate(new Date(fu.follow_up_date));
            setFollowUpNotes(fu.notes || "");
          }
        }

        // Neurological exam fields (flat on the response root)
        const neuroData = {};
        NEURO_KEYS.forEach((k) => {
          if (data[k] !== undefined && data[k] !== null) neuroData[k] = data[k];
        });
        // diagnosis lives under neuro_diagnosis in the API response
        if (data.neuro_diagnosis) neuroData.diagnosis = data.neuro_diagnosis;
        if (data.neuro_treatment_plan) neuroData.treatment_plan = data.neuro_treatment_plan;
        setNeuroExamData(neuroData);

        // Prescriptions
        if (Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
          setSelectedMedicines(
            data.prescriptions.map((p) => ({
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
            }))
          );
        }

        // Tests — DiagnosisTestSection expects string IDs
        if (Array.isArray(data.tests) && data.tests.length > 0) {
          setSelectedTests(
            data.tests.filter((t) => t.test_id).map((t) => String(t.test_id))
          );
        }

        // Symptoms — names need to be matched to Redux options (may not be ready yet)
        const symptomNames = Array.isArray(data.symptoms)
          ? data.symptoms.filter(Boolean)
          : [];
        if (symptomNames.length > 0) {
          setPendingSymptomNames(symptomNames);
        }
      } catch (err) {
        setFetchError(`Failed to load consultation: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [patientId, consultationId]);

  // Match symptom names → Redux options once both are ready
  useEffect(() => {
    if (!symptomsOptions.length || !pendingSymptomNames.length) return;
    const nameSet = new Set(pendingSymptomNames.map((n) => n.toLowerCase()));
    const matched = symptomsOptions.filter((s) =>
      nameSet.has(s.label?.toLowerCase())
    );
    if (matched.length > 0) setSelectedSymptoms(matched);
    setPendingSymptomNames([]);
  }, [symptomsOptions, pendingSymptomNames]);

  const handlePrint = () => {
    if (!patient) return;
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
    } catch {}
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        symptoms: selectedSymptoms
          .map((s) => Number(s.value))
          .filter((n) => !isNaN(n) && n > 0),

        prescriptions: selectedMedicines
          .filter((m) => m.medicine_id && Number(m.medicine_id) > 0)
          .map((med) => ({
            medicine_id: Number(med.medicine_id),
            dosage_en: med.dosage_en?.trim() || "",
            dosage_urdu: med.dosage_urdu?.trim() || "",
            frequency_en: med.frequency_en?.trim() || "",
            frequency_urdu: med.frequency_urdu?.trim() || "",
            duration_en: med.duration_en?.trim() || "",
            duration_urdu: med.duration_urdu?.trim() || "",
            instructions_en: med.instructions_en?.trim() || "",
            instructions_urdu: med.instructions_urdu?.trim() || "",
            how_to_take_en: med.how_to_take_en?.trim() || null,
            how_to_take_urdu: med.how_to_take_urdu?.trim() || null,
          })),

        tests: selectedTests
          .map(Number)
          .filter((n) => !isNaN(n) && n > 0),

        vital_signs: Object.values(vitalSigns).some((v) => v !== "" && v !== null)
          ? [{
              pulse_rate: Number(vitalSigns.pulseRate) || null,
              blood_pressure: vitalSigns.bloodPressure?.trim() || null,
              temperature: Number(vitalSigns.temperature) || null,
              spo2_level: Number(vitalSigns.spo2) || null,
              nihss_score: Number(vitalSigns.nihss) || null,
              fall_assessment: vitalSigns.fall_assessment || "Done",
            }]
          : [],

        neurological_exams: Object.keys(neuroExamData).length > 0
          ? {
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
            }
          : undefined,

        follow_ups:
          followUpDate instanceof Date && !isNaN(followUpDate)
            ? [{
                follow_up_date: followUpDate.toISOString().split("T")[0],
                notes: followUpNotes?.trim() || "",
              }]
            : [],
      };

      await apiClient.put(`/api/patients/consultations/${consultationId}`, payload);

      // Bust stale caches
      try {
        sessionStorage.removeItem(`fc:patient-history:${patientId}`);
      } catch {}
      dispatch(invalidateDashboard());

      toast.success("Consultation updated successfully!");
      try { handlePrint(); } catch {}
      navigate(`/patients/${patientId}`);
    } catch (err) {
      toast.error(err.message || "Failed to update consultation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 relative overflow-hidden isolate w-[90vw] mx-auto before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_transparent)] before:opacity-50 before:-z-10">
      <div className="mx-auto max-w-6xl rounded-2xl border border-white/30 bg-white/95 backdrop-blur-sm p-8 shadow-2xl shadow-gray-100/30">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-100 flex items-center gap-4">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-2xl shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Edit Consultation</h2>
            <p className="text-sm text-gray-500">
              Update the details below and click <strong>Save Consultation</strong> when done
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 text-sm text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>

        {/* Content */}
        {loading || appLoading.medicines || appLoading.symptoms ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <Loader message="Loading consultation..." />
          </div>
        ) : fetchError ? (
          <div className="flex items-center justify-center flex-col gap-4 py-16">
            <p className="text-lg text-red-600">{fetchError}</p>
            <button
              onClick={() => navigate("/")}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg"
            >
              Return to Home
            </button>
          </div>
        ) : patient ? (
          <>
            <PatientInfoHeader
              patient={patient}
              onReturnHome={() => navigate("/")}
              setShowPopup={() => {}}
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
              loading={submitting}
              selectedMedicines={selectedMedicines}
              setSelectedMedicines={setSelectedMedicines}
              customSelectStyles={customSelectStyles}
              selectedDuration={selectedDuration}
              followUpDate={followUpDate}
              followUpNotes={followUpNotes}
              onDurationChange={setSelectedDuration}
              onDateChange={setFollowUpDate}
              onNotesChange={setFollowUpNotes}
              onSubmit={handleSubmit}
              onPrint={handlePrint}
              medicines={medicines}
              symptomsOptions={symptomsOptions}
              refreshMedicines={refreshMedicines}
            />
          </>
        ) : (
          <div className="flex items-center justify-center flex-col gap-4 py-16">
            <p className="text-lg text-red-600">No consultation data found.</p>
            <button
              onClick={() => navigate("/")}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg"
            >
              Return to Home
            </button>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
};

export default EditConsultation;
