import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axiosClient';
import { toast } from 'react-toastify';
import Loader from '../pages/Loader';
import { FaArrowLeft, FaPrint, FaFlask, FaUser } from 'react-icons/fa';
import DiagnosisTestSection from './DiagnosisTestSection';

const BASE_URL = '';
const DOCTOR_NAME = 'Dr. Umer'; 
const AddTestForm = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [selectedTests, setSelectedTests] = useState([]);
  const [testDetails, setTestDetails] = useState([]); // Store test details
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch patient details
  useEffect(() => {
    const fetchPatient = async () => {
      setIsLoadingPatient(true);
      try {
        const response = await axios.get(`${BASE_URL}/api/patients/${patientId}`);
        setPatient(response.data);
      } catch (error) {
        toast.error(`Failed to fetch patient: ${error.response?.data?.error || error.message}`);
        navigate('/');
      } finally {
        setIsLoadingPatient(false);
      }
    };
    if (patientId) {
      fetchPatient();
    } else {
      toast.error('Invalid patient ID');
      navigate('/');
    }
  }, [patientId, navigate]);

  // Fetch test details for selected tests
  useEffect(() => {
    const fetchTestDetails = async () => {
      if (selectedTests.length === 0) {
        setTestDetails([]);
        return;
      }
      try {
        // Fetch all tests and filter by selected IDs
        const response = await axios.get(`${BASE_URL}/api/tests`);
        const tests = response.data.filter((test) =>
          selectedTests.includes(test.id.toString())
        );
        setTestDetails(tests);
      } catch (error) {
        toast.error('Failed to fetch test details');
      }
    };
    fetchTestDetails();
  }, [selectedTests]);

  const handleSaveTests = async () => {
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }
    setIsSaving(true);
    try {
      // Step 1: Create a new consultation
      const consultationResponse = await axios.post(`${BASE_URL}/api/consultations`, {
        patient_id: patientId,
        doctor_name: DOCTOR_NAME,
        visit_date: new Date().toISOString(),
        notes: 'Consultation created for assigning diagnostic tests',
      });
      const consultationId = consultationResponse.data.consultation?.id;

      if (!consultationId) {
        throw new Error('Consultation ID not found in response');
      }

      // Step 2: Assign tests to the consultation
      // Handle both string array and object array formats
      const testIds = Array.isArray(selectedTests)
        ? selectedTests.every((test) => typeof test === 'string')
          ? selectedTests
          : selectedTests.map((test) => test.value)
        : [];
      // Filter out invalid IDs
      const validTestIds = testIds.filter((id) => id != null && id !== '');

      if (validTestIds.length === 0) {
        throw new Error('No valid test IDs selected');
      }

      await axios.post(`${BASE_URL}/api/tests/assign`, {
        consultation_id: consultationId,
        test_ids: validTestIds,
      });

      toast.success('Tests assigned to consultation successfully');
      handlePrint();
      navigate(`/patients/${patientId}`, { replace: true });
    } catch (error) {
      toast.error(`Failed to save tests: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const testLabels = testDetails.map((test) => test.test_name || test.id);
    const printWindow = window.open('', '_blank');
    const printDate = new Date().toLocaleString(); // Initialize printWindow
    printWindow.document.write(`
        <html>
          <head>
            <title>Diagnostic Test Order - ${patient?.name || 'Patient'}</title>
            <style>
              :root {
                --primary-color: #2a4365;
                --secondary-color: #718096;
                --accent-color: #4299e1;
              }
  
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 2cm auto;
                max-width: 21cm;
                padding: 30px;
                color: #333;
              }
  
              .letterhead {
                text-align: center;
                border-bottom: 3px solid var(--primary-color);
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
  
              .clinic-name {
                font-size: 24px;
                font-weight: 600;
                color: var(--primary-color);
                letter-spacing: 1px;
                margin-bottom: 8px;
              }
  
              .clinic-address {
                color: var(--secondary-color);
                font-size: 14px;
              }
  
              .patient-info {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                background: #f8fafc;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              }
  
              .info-group h3 {
                font-size: 16px;
                color: var(--accent-color);
                margin-bottom: 12px;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 6px;
              }
  
              .info-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 14px;
              }
  
              .info-item span:first-child {
                font-weight: 500;
                color: var(--secondary-color);
              }
  
              .test-list {
                margin: 25px 0;
                counter-reset: test-counter;
              }
  
              .test-item {
                padding: 15px;
                margin-bottom: 12px;
                background: white;
                border-left: 4px solid var(--accent-color);
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                counter-increment: test-counter;
                display: flex;
                align-items: center;
              }
  
              .test-item::before {
                content: counter(test-counter);
                background: var(--accent-color);
                color: white;
                width: 25px;
                height: 25px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                margin-right: 15px;
                font-size: 14px;
              }
  
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                font-size: 12px;
                color: var(--secondary-color);
                text-align: center;
              }
  
              @media print {
                body { 
                  margin: 1cm auto;
                }
                .patient-info {
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
  
            <div class="patient-info">
              <div class="info-group">
                <h3>Patient Details</h3>
                <div class="info-item">
                  <span>Patient ID:</span>
                  <span>${patientId}</span>
                </div>
                <div class="info-item">
                  <span>Patient Name:</span>
                  <span>${patient?.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                  <span>Patinet Mobile:</span>
                  <span>${patient?.mobile || 'N/A'}</span>
                </div>
              </div>
  
              <div class="info-group">
                <h3>Ordering Physician</h3>
                <div class="info-item">
                  <span>Doctor Name:</span>
                  <span>${DOCTOR_NAME}</span>
                </div>
                <div class="info-item">
                  <span>Date:</span>
                  <span>${printDate}</span>
                </div>
              </div>
            </div>
  
            <div class="test-list">
              ${testDetails.map((test, index) => `
                <div class="test-item">
                  ${test.test_name || test.id}
                </div>
              `).join('')}
            </div>
  
            <div class="footer">
              <div>Generated electronically</div>
              <div>Printed on ${printDate}</div>
            </div>
          </body>
        </html>
      `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleBack = () => {
    navigate(`/patients/${patientId}`);
  };

  if (isLoadingPatient) {
    return <Loader message="Loading patient details..." color="purple-600" />;
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl border border-gray-100 shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <FaFlask className="text-3xl text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800">Add Tests for Patient</h2>
        </div>

        {/* Patient Details */}
        {patient && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <FaUser className="text-xl text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">Patient Details</h3>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-gray-900">{patient.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Mobile</label>
                <p className="text-gray-900">{patient.mobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Patient ID</label>
                <p className="text-gray-900">{patientId}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold"
        >
          <FaArrowLeft />
          Back to Patient Profile
        </button>

        {/* Test Selection */}
        <DiagnosisTestSection
          selectedTests={selectedTests}
          onTestsChange={setSelectedTests}
        />

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 justify-end">
          <button
            onClick={handleSaveTests}
            className={`flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold ${
              isSaving || selectedTests.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-purple-700'
            }`}
            disabled={isSaving || selectedTests.length === 0}
          >
            {isSaving ? 'Saving...' : 'Save Tests'}
          </button>
          <button
            onClick={handlePrint}
            className={`flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold ${
              selectedTests.length === 0 || isSaving
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-700'
            }`}
            disabled={selectedTests.length === 0 || isSaving}
          >
            <FaPrint />
            Print Tests
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTestForm;