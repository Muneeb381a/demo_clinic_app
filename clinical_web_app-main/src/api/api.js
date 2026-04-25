import apiClient from "../utils/axiosClient";

export const searchPatientByMobile = async (mobile) => {
    return apiClient.get(`/api/patients/search?mobile=${mobile}`);
};

export const getPatientHistory = async (patient_id) => {
    try {
        const response = await apiClient.get(`/api/patients/${patient_id}/history`);
        return response.data;
    } catch (error) {
        console.error("Error fetching patient history:", error);
        return null;
    }
};

export const createPatient = async (data) => {
    return apiClient.post(`/api/patients`, data);
};

export const addConsultation = async (data) => {
    return apiClient.post(`/api/consultations`, data);
};

export const fetchSymptoms = async () => {
    const response = await apiClient.get("/api/symptoms");
    return response.data;
};

export const fetchMedicines = async () => {
    const response = await apiClient.get("/api/medicines");
    return response.data;
};
