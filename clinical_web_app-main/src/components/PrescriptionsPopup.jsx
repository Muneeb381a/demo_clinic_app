import React from 'react';
import { motion } from 'framer-motion';
import { AiOutlineClose, AiOutlineCalendar, AiOutlineClockCircle, AiOutlineMedicineBox, AiOutlineFileText } from 'react-icons/ai';
import { FiDroplet, FiClock, FiCalendar, FiInfo } from 'react-icons/fi';

const PrescriptionsPopup = ({ prescriptions, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    className="fixed inset-0 bg-gray-900/70 backdrop-blur-md z-50 overflow-y-auto"
  >
    <div className="min-h-screen flex items-start justify-center p-6 pt-20 pb-10">
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-auto border border-gray-200 overflow-hidden"
      >
        <div className="px-6 py-5 bg-gradient-to-r from-teal-100 to-blue-100 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="bg-teal-200 p-3 rounded-full shadow-md">
                <AiOutlineFileText className="w-8 h-8 text-teal-700" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Treatment History</h2>
                <p className="text-sm text-gray-600 mt-1 font-medium">Previous Prescriptions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-all duration-200"
            >
              <AiOutlineClose className="w-6 h-6 text-gray-600 hover:text-red-600" />
            </button>
          </div>
        </div>
        <div className="p-8 bg-gray-50">
          <div className="space-y-10">
            {prescriptions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg font-medium text-gray-600">No prescriptions available.</p>
              </div>
            ) : (
              Object.entries(
                prescriptions.reduce((acc, prescription) => {
                  const dateKey = new Date(prescription.prescribed_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  if (!acc[dateKey]) acc[dateKey] = [];
                  acc[dateKey].push(prescription);
                  return acc;
                }, {})
              ).map(([date, datePrescriptions], index) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <AiOutlineCalendar className="w-7 h-7 text-teal-600" />
                    <span className="text-xl font-semibold text-gray-900">{date}</span>
                    <span className="text-gray-300">•</span>
                    <AiOutlineClockCircle className="w-7 h-7 text-teal-600" />
                    <span className="text-base text-gray-600">
                      {new Date(datePrescriptions[0].prescribed_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="space-y-5 pl-12 relative">
                    {datePrescriptions.map((prescription) => (
                      <div
                        key={prescription.id}
                        className="group bg-white p-6 rounded-xl shadow-md hover:shadow-lg hover:bg-teal-100/30 transition-all duration-300 border border-gray-200"
                      >
                        <div className="flex items-start gap-6">
                          <div className="p-3 bg-teal-200 rounded-full shadow-sm mt-1">
                            <AiOutlineMedicineBox className="w-6 h-6 text-teal-700" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-4 mb-4">
                              <h3 className="text-xl font-semibold text-gray-900">{prescription.brand_name}</h3>
                              <span className="text-sm text-teal-600 bg-teal-100 px-2.5 py-1 rounded-full shadow-sm">
                                #{prescription.id}
                              </span>
                            </div>
                            {prescription.urdu_name && (
                              <div className="mb-5">
                                <p className="text-lg font-medium text-gray-700 urdu-font border-l-4 border-teal-300 pl-4">
                                  {prescription.urdu_name}
                                </p>
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-all duration-200">
                                <div className="p-1.5 bg-teal-100 rounded-full">
                                  <FiDroplet className="w-5 h-5 text-teal-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">Dosage</p>
                                  {prescription.dosage_en && <p className="text-sm text-gray-600">{prescription.dosage_en}</p>}
                                  {prescription.dosage_urdu && (
                                    <p className="text-sm text-gray-600 urdu-font mt-1 border-l-2 border-teal-200 pl-2">{prescription.dosage_urdu}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-all duration-200">
                                <div className="p-1.5 bg-teal-100 rounded-full">
                                  <FiClock className="w-5 h-5 text-teal-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">Frequency</p>
                                  {prescription.frequency_en && <p className="text-sm text-gray-600">{prescription.frequency_en}</p>}
                                  {prescription.frequency_urdu && (
                                    <p className="text-sm text-gray-600 urdu-font mt-1 border-l-2 border-teal-200 pl-2">{prescription.frequency_urdu}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-all duration-200">
                                <div className="p-1.5 bg-teal-100 rounded-full">
                                  <FiCalendar className="w-5 h-5 text-teal-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">Duration</p>
                                  {prescription.duration_en && <p className="text-sm text-gray-600">{prescription.duration_en}</p>}
                                  {prescription.duration_urdu && (
                                    <p className="text-sm text-gray-600 urdu-font mt-1 border-l-2 border-teal-200 pl-2">{prescription.duration_urdu}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-all duration-200">
                                <div className="p-1.5 bg-teal-100 rounded-full">
                                  <FiInfo className="w-5 h-5 text-teal-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">Instructions</p>
                                  {prescription.instructions_en && <p className="text-sm text-gray-600">{prescription.instructions_en}</p>}
                                  {prescription.instructions_urdu && (
                                    <p className="text-sm text-gray-600 urdu-font mt-1 border-l-2 border-teal-200 pl-2">{prescription.instructions_urdu}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="absolute left-6 top-0 bottom-0 w-1 bg-teal-300 group-last:hidden transition-all duration-300" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 bg-gray-100">
          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3"
            >
              <AiOutlineClose className="w-5 h-5" />
              Close Overview
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  </motion.div>
);

export default PrescriptionsPopup;