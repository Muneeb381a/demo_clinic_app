import { useState, useEffect } from "react";
import axios from "../utils/axiosClient";
import { useParams, useNavigate } from "react-router-dom";
import { IoManOutline } from "react-icons/io5";
import { FaPersonFallingBurst } from "react-icons/fa6";

import {
  FaTimes,
  FaNotesMedical,
  FaCalendarAlt,
  FaStethoscope,
  FaPills,
  FaFlask,
  FaChevronDown,
  FaChevronUp,
  FaHeartbeat,
  FaHeart,
  FaThermometerHalf,
  FaBrain,
  FaLungs,
  FaSyringe,
  FaRegClock,
  FaFileMedical,
  FaHandHoldingMedical,
  FaCalendar,
} from "react-icons/fa";
import { MdOutlineFilterList } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";

const PatientHistory = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (index) => {
    setExpandedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const fetchHistory = async () => {
    if (!patientId) {
      setError("Patient ID is required");
      return;
    }

    setFilterDate("");
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `/api/patient-history/${patientId}`,
        {
          timeout: 10000,
        }
      );
      setHistory(
        Array.isArray(response.data) ? response.data : [response.data]
      );
      setShowModal(true);
    } catch (err) {
      setError(`Failed to fetch patient history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  }, [history]);

  const handleEditClick = (consultationId) => {
    navigate(`/patients/${patientId}/consultations/${consultationId}/edit`);
  };

  const handleRepeatPrescription = (record) => {
    setShowModal(false);
    navigate(`/patients/${patientId}/consultation`, {
      state: {
        clonedConsultation: {
          prescriptions: record.prescriptions || [],
          tests: record.tests || [],
          symptoms: record.symptoms || [],
        },
      },
    });
  };

  const DetailItem = ({ label, valueEn, valueUr, icon }) => (
    <div className="detail-item bg-gray-50 p-3 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="icon-box pt-1">{icon}</div>
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-gray-600 mb-1.5">
            {label}
          </h4>
          <div className="space-y-1.5">
            {valueEn && (
              <div className="text-sm text-gray-800 leading-tight">
                <span className="text-xs text-gray-500 mr-2">EN</span>
                {valueEn}
              </div>
            )}
            {valueUr && (
              <div className="text-sm text-gray-800 leading-tight" dir="rtl">
                <span className="text-xs text-gray-500 ml-2">UR</span>
                {valueUr}
              </div>
            )}
            {!valueEn && !valueUr && (
              <div className="text-sm text-gray-400">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button
        onClick={fetchHistory}
        className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-bold hover:from-teal-700 hover:to-cyan-700 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        disabled={loading}
      >
        {loading ? (
          <svg
            className="w-5 h-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0V4a8 8 0 018 8h-4l3.5 3.5L20 12h-4a8 8 0 01-8 8v-4l-3.5 3.5L4 20v-4a8 8 0 01-8-8h4z"
            />
          </svg>
        ) : (
          <FaNotesMedical className="text-lg" />
        )}
        {loading ? "Loading History..." : "View Medical History"}
      </button>

      {error && (
        <p className="text-center text-red-600 mt-4 font-medium">{error}</p>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-center items-start pt-20 backdrop-blur-md bg-opacity-50"
          >
            <motion.div
              initial={{ y: -20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -20, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                    Medical History
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {patientId} • {history.length} records found
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                >
                  <FaTimes className="text-2xl text-gray-500 hover:text-red-600" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-block p-4 bg-gray-100 rounded-full">
                    <FaNotesMedical className="text-4xl text-gray-400" />
                  </div>
                  <p className="mt-4 text-gray-500 font-medium">
                    No medical history records found for this patient.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {history
                    .filter(
                      (record) =>
                        !filterDate || record.visit_date.startsWith(filterDate)
                    )
                    .map((record, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                        onClick={() => toggleSection(index)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-teal-100 rounded-lg">
                              <FaCalendarAlt className="text-teal-600 text-xl" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">
                                {new Date(record.visit_date).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                )}
                              </h3>
                              {record.follow_up_date && (
                                <p className="text-sm text-gray-500 mt-1">
                                  Follow-up:{" "}
                                  {new Date(
                                    record.follow_up_date
                                  ).toLocaleDateString("en-PK", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleSection(index)}
                            className="text-gray-500 hover:text-teal-600 p-2 rounded-lg"
                          >
                            {expandedSections[index] ? (
                              <FaChevronUp />
                            ) : (
                              <FaChevronDown />
                            )}
                          </button>
                        </div>

                        {expandedSections[index] && (
                          <div className="space-y-6 pt-4 border-t border-gray-100">
                            <div className="mt-4 flex gap-4 justify-end flex-wrap">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRepeatPrescription(record); }}
                                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm"
                              >
                                <FaPills />
                                Repeat Prescription
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditClick(record.consultation_id); }}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                              >
                                Edit Consultation
                              </button>
                            </div>

                            {/* Patient Information */}
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <FaNotesMedical className="text-gray-600" />
                                <h4 className="font-semibold text-gray-900">
                                  Patient Information
                                </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">
                                    Name
                                  </label>
                                  <p className="mt-2 text-gray-900">
                                    {record.patient_name || "Not specified"}
                                  </p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">
                                    Mobile
                                  </label>
                                  <p className="mt-2 text-gray-900">
                                    {record.mobile || "Not specified"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Diagnosis & Symptoms */}
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <FaNotesMedical className="text-gray-600" />
                                <h4 className="font-semibold text-gray-900">
                                  Diagnosis & Symptoms
                                </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">
                                    Diagnosis
                                  </label>
                                  <p className="mt-2 text-gray-900">
                                    {record.neuro_diagnosis || "Not specified"}
                                  </p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">
                                    Symptoms
                                  </label>
                                  <p className="mt-2 text-gray-900">
                                    {record.symptoms
                                      ?.filter(Boolean)
                                      .join(", ") || "No symptoms recorded"}
                                  </p>
                                </div>
                                <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">
                                    Treatment Plan
                                  </label>
                                  <p className="mt-2 text-gray-900">
                                    {record.neuro_treatment_plan ||
                                      "Not specified"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Tests */}
                            <div>
                              <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-blue-100 rounded-lg">
                                  <FaFlask className="text-xl text-blue-600" />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-900">
                                  Tests
                                </h4>
                              </div>
                              <p className="text-gray-800 font-medium leading-relaxed">
                                {record.tests?.length > 0 ? (
                                  <span className="inline-flex flex-wrap gap-2">
                                    {record.tests.map((test) => (
                                      <span
                                        key={test.test_id}
                                        className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm"
                                      >
                                        {test.test_name}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 italic">
                                    No tests prescribed
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Vital Signs */}
                            {record.vital_signs?.length > 0 && (
                              <div className="mt-6 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2.5 bg-red-100 rounded-lg">
                                    <FaHeartbeat className="text-xl text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">
                                    Vital Signs
                                  </h4>
                                </div>
                                <div className="overflow-x-auto pb-4">
                                  <div className="flex gap-2 min-w-max">
                                    {record.vital_signs.map((vital, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white p-4 border-b border-gray-100 transition-all min-w-[300px]"
                                      >
                                        <div className="flex flex-col gap-3">
                                          <div className="flex gap-2">
                                            <div className="flex items-center justify-center gap-2 p-2 bg-red-50 rounded-lg flex-1 min-w-[150px]">
                                              <FaHeartbeat className="text-red-600" />
                                              <div>
                                                <p className="text-xs font-medium text-red-700">
                                                  BP
                                                </p>
                                                <p className="text-lg font-bold text-gray-900">
                                                  {vital.blood_pressure ||
                                                    "N/A"}
                                                  <span className="text-xs text-gray-500 ml-1">
                                                    mmHg
                                                  </span>
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-center gap-2 p-2 bg-blue-50 rounded-lg flex-1 min-w-[110px]">
                                              <FaHeart className="text-blue-600" />
                                              <div>
                                                <p className="text-xs font-medium text-blue-700">
                                                  Pulse
                                                </p>
                                                <p className="text-lg font-bold text-gray-900">
                                                  {vital.pulse_rate || "N/A"}
                                                  <span className="text-xs text-gray-500 ml-1">
                                                    bpm
                                                  </span>
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-center gap-2 p-2 bg-orange-50 rounded-lg flex-1 min-w-[110px]">
                                              <FaThermometerHalf className="text-orange-600" />
                                              <div>
                                                <p className="text-xs font-medium text-orange-700">
                                                  Temp
                                                </p>
                                                <p className="text-lg font-bold text-gray-900">
                                                  {vital.temperature || "N/A"}
                                                  <span className="text-xs text-gray-500 ml-1">
                                                    °C
                                                  </span>
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-center gap-2 p-2 bg-green-50 rounded-lg flex-1 min-w-[110px]">
                                              <FaLungs className="text-green-600" />
                                              <div>
                                                <p className="text-xs font-medium text-green-700">
                                                  SpO₂
                                                </p>
                                                <p className="text-lg font-bold text-gray-900">
                                                  {vital.spo2_level || "N/A"}
                                                  <span className="text-xs text-gray-500 ml-1">
                                                    %
                                                  </span>
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-center gap-2 p-2 bg-green-50 rounded-lg flex-1 min-w-[110px]">
                                              <IoManOutline  className="text-green-600" />
                                              <div>
                                                <p className="text-xs font-medium text-green-700">
                                                  NIHSS
                                                </p>
                                                <p className="text-lg font-bold text-gray-900">
                                                  {vital.nihss_score || "N/A"}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-center gap-2 p-2 bg-green-50 rounded-lg flex-1 min-w-[110px]">
                                              <FaPersonFallingBurst  className="text-green-600" />
                                              <div>
                                                <p className="text-xs font-medium text-green-700">
                                                  Fall Assessment
                                                </p>
                                                <p className="text-lg font-bold text-gray-900">
                                                  {vital.fall_assessment || "N/A"}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                          <p className="text-xs text-gray-500">
                                            Recorded:{" "}
                                            {vital.recorded_at
                                              ? new Date(
                                                  vital.recorded_at
                                                ).toLocaleString()
                                              : "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Prescriptions */}
                            {record.prescriptions?.length > 0 && (
                              <section className="prescription-section mb-16 space-y-12">
                                <header className="section-header">
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-blue-100 rounded-lg">
                                      <FaPills className="text-xl text-blue-600" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-gray-900">
                                      Medication
                                    </h4>
                                  </div>
                                </header>

                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                  {record.prescriptions.map(
                                    (prescription, idx) => (
                                      <article
                                        key={idx}
                                        className="relative bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100"
                                      >
                                        <div className="space-y-5">
                                          {/* Medication Header */}
                                          <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                              <h3 className="text-xl font-semibold text-gray-900">
                                                {prescription.brand_name ||
                                                  "Unspecified Medication"}
                                              </h3>
                                              <p className="font-urdu text-right text-lg text-gray-700 leading-relaxed">
                                                {prescription.generic_name}
                                              </p>
                                            </div>
                                            <span className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-full font-urdu-blue">
                                              {prescription.duration_urdu ||
                                                "Duration"}
                                            </span>
                                          </div>

                                          {/* Details Grid */}
                                          <div className="space-y-4 font-urdu-blue text-right text-blue-500">
                                            <DetailItem
                                              label="Dosage"
                                              valueUr={prescription.dosage_urdu}
                                              icon={
                                                <FaSyringe className="text-gray-500" />
                                              }
                                              urduClass="font-urdu-blue text-right text-blue-700 text-base"
                                            />

                                            <DetailItem
                                              label="Frequency"
                                              valueEn={
                                                prescription.frequency_en
                                              }
                                              valueUr={
                                                prescription.frequency_urdu
                                              }
                                              icon={
                                                <FaRegClock className="text-gray-500" />
                                              }
                                              className="font-urdu text-right text-urdu-blue text-base leading-relaxed"
                                            />

                                            <DetailItem
                                              label="Instructions"
                                              valueEn={
                                                prescription.instructions_en
                                              }
                                              valueUr={
                                                prescription.instructions_urdu
                                              }
                                              icon={
                                                <FaFileMedical className="text-gray-500" />
                                              }
                                              className="font-urdu text-right text-gray-700 text-base"
                                            />
                                          </div>

                                          {/* Prescription Date */}
                                          <div className="pt-4 border-t border-gray-100">
                                            <div className="flex items-center justify-between text-sm">
                                              <span className="flex items-center gap-2 text-gray-500">
                                                <FaCalendar className="w-4 h-4" />
                                                <span>Prescribed</span>
                                              </span>
                                              <span className="font-medium text-gray-700">
                                                {prescription.prescribed_at
                                                  ? new Date(
                                                      prescription.prescribed_at
                                                    ).toLocaleDateString(
                                                      "en-GB"
                                                    )
                                                  : "No date"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </article>
                                    )
                                  )}
                                </div>
                              </section>
                            )}
                            {/* Neurological Examination Findings */}
                            {(record.cranial_nerves ||
                              record.motor_function ||
                              record.muscle_strength ||
                              record.muscle_tone ||
                              record.coordination ||
                              record.deep_tendon_reflexes ||
                              record.gait_assessment ||
                              record.romberg_test ||
                              record.plantar_reflex ||
                              record.straight_leg_raise_test ||
                              record.brudzinski_sign ||
                              record.kernig_sign ||
                              record.mmse_score ||
                              record.gcs_score ||
                              record.power ||
                              record.notes) && (
                              <div className="mt-6 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2.5 bg-blue-100 rounded-lg">
                                    <FaBrain className="text-xl text-blue-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">
                                    Neurological Examination Findings
                                  </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {(record.cranial_nerves || record.notes) && (
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                      <h5 className="font-medium text-blue-800 mb-2">
                                        Cranial Nerve Assessment
                                      </h5>
                                      <div className="space-y-2">
                                        {record.cranial_nerves && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Cranial Nerves:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.cranial_nerves}
                                            </span>
                                          </div>
                                        )}
                                        {record.notes && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Clinical Notes:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.notes}
                                            </span>
                                          </div>
                                        )}
                                        {record.power && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Power:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.power}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {(record.motor_function ||
                                    record.muscle_strength ||
                                    record.muscle_tone ||
                                    record.coordination ||
                                    record.deep_tendon_reflexes) && (
                                    <div className="bg-green-50 p-4 rounded-lg">
                                      <h5 className="font-medium text-green-800 mb-2">
                                        Motor Function Assessment
                                      </h5>
                                      <div className="space-y-2">
                                        {record.motor_function && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Motor Function:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.motor_function}
                                            </span>
                                          </div>
                                        )}
                                        {record.muscle_strength && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Muscle Strength:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.muscle_strength}
                                            </span>
                                          </div>
                                        )}
                                        {record.muscle_tone && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Muscle Tone:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.muscle_tone}
                                            </span>
                                          </div>
                                        )}
                                        {record.coordination && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Coordination:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.coordination}
                                            </span>
                                          </div>
                                        )}
                                        {record.deep_tendon_reflexes && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Deep Tendon Reflexes:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.deep_tendon_reflexes}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {(record.gait_assessment ||
                                    record.romberg_test ||
                                    record.plantar_reflex ||
                                    record.straight_leg_raise_test) && (
                                    <div className="bg-orange-50 p-4 rounded-lg">
                                      <h5 className="font-medium text-orange-800 mb-2">
                                        Special Tests
                                      </h5>
                                      <div className="space-y-2">
                                        {record.gait_assessment && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Gait Assessment:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.gait_assessment}
                                            </span>
                                          </div>
                                        )}
                                        {record.romberg_test && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Romberg Test:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.romberg_test}
                                            </span>
                                          </div>
                                        )}
                                        {record.plantar_reflex && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Plantar Reflex:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.plantar_reflex}
                                            </span>
                                          </div>
                                        )}
                                        {record.straight_leg_raise_test && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Straight Leg Raise Test:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.straight_leg_raise_test}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {(record.brudzinski_sign ||
                                    record.kernig_sign ||
                                    record.mmse_score ||
                                    record.gcs_score) && (
                                    <div className="bg-purple-50 p-4 rounded-lg">
                                      <h5 className="font-medium text-purple-800 mb-2">
                                        Additional Assessments
                                      </h5>
                                      <div className="space-y-2">
                                        {record.brudzinski_sign !==
                                          undefined && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Brudzinski's Sign:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.brudzinski_sign
                                                ? "Positive"
                                                : "Negative"}
                                            </span>
                                          </div>
                                        )}
                                        {record.kernig_sign !== undefined && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              Kernig's Sign:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.kernig_sign
                                                ? "Positive"
                                                : "Negative"}
                                            </span>
                                          </div>
                                        )}
                                        {record.mmse_score && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              MMSE Score:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.mmse_score}
                                            </span>
                                          </div>
                                        )}
                                        {record.gcs_score && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">
                                              GCS Score:
                                            </span>
                                            <span className="font-medium text-gray-800">
                                              {record.gcs_score}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PatientHistory;
