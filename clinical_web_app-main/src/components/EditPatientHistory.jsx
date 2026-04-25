// EditConsultationForm.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axiosClient';
import { toast } from 'react-toastify';

const EditConsultationForm = () => {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    symptoms: [],
    tests: [],
    vitalSigns: {},
    neuroExam: {},
    medicines: [],
    followUp: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`/api/consultations/${consultationId}`);
        setFormData(response.data);
      } catch (error) {
        toast.error('Failed to load consultation data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [consultationId]);

  const handleChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleArrayChange = (section, items) => {
    setFormData(prev => ({
      ...prev,
      [section]: items
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/consultations/${consultationId}`, formData);
      toast.success('Consultation updated successfully!');
      window.history.back(); // Go back to previous page
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="edit-form-container">
      <h2>Edit Consultation</h2>
      <form onSubmit={handleSubmit}>
        {/* Vital Signs Section */}
        <div className="section">
          <h3>Vital Signs</h3>
          <input
            type="number"
            value={formData.vitalSigns.pulseRate || ''}
            onChange={(e) => handleChange('vitalSigns', 'pulseRate', e.target.value)}
            placeholder="Pulse Rate"
          />
          {/* Add other vital signs fields */}
        </div>

        {/* Symptoms Section */}
        <div className="section">
          <h3>Symptoms</h3>
          <MultiSelect
            items={allSymptoms}
            selected={formData.symptoms}
            onChange={(selected) => handleArrayChange('symptoms', selected)}
          />
        </div>

        {/* Neuro Exam Section */}
        <div className="section">
          <h3>Neurological Exam</h3>
          <textarea
            value={formData.neuroExam.notes || ''}
            onChange={(e) => handleChange('neuroExam', 'notes', e.target.value)}
          />
          {/* Add other neuro exam fields */}
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => window.history.back()}>
          Cancel
        </button>
      </form>
    </div>
  );
};

