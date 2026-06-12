import api from './api';

const PatientService = {
    fetchPatients: async () => {
        const response = await api.get('/patients');
        return response.data;
    },

    createPatient: async (patientData) => {
        let formData = patientData;
        if (!(patientData instanceof FormData)) {
            formData = new FormData();
            Object.keys(patientData).forEach(key => {
                if (patientData[key] !== null && patientData[key] !== undefined) {
                    formData.append(key, patientData[key]);
                }
            });
        }
        const response = await api.post('/patients/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    fetchPatientById: async (patient_id) => {
        const response = await api.get(`/patients/${patient_id}`);
        return response.data;
    },

    updatePatient: async (patient_id, data) => {
        let formData = data;
        if (!(data instanceof FormData)) {
            formData = new FormData();
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    formData.append(key, data[key]);
                }
            });
        }
        const response = await api.put(`/patients/${patient_id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    deletePatient: async (patient_id) => {
        await api.delete(`/patients/${patient_id}/`);
        return patient_id;
    },

    fetchPatientIntake: async (patient_id) => {
        const response = await api.get(`/patients/${patient_id}/intake`);
        return response.data;
    },

    createPatientIntake: async (patient_id, intakeData) => {
        const response = await api.post(`/patients/${patient_id}/intake`, intakeData);
        return response.data;
    },

    fetchPatientFile: async (patient_id) => {
        const response = await api.get(`/patients/${patient_id}/file`);
        return response.data;
    },

    updatePatientFile: async (patient_id, fileData) => {
        const response = await api.put(`/patients/${patient_id}/file`, fileData);
        return response.data;
    }
};

export default PatientService;
