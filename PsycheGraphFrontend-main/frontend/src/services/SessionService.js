import api from './api';

const SessionService = {
    fetchSessions: async (patientId = null) => {
        const url = patientId ? `/sessions?patient_id=${patientId}` : '/sessions';
        const response = await api.get(url);
        return response.data;
    },

    fetchLanguages: async () => {
        const response = await api.get('/sessions/languages');
        return response.data;
    },

    createSession: async (formData) => {
        const response = await api.post('/sessions/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    createSoapNote: async (payload) => {
        // Ensure mapping to Backend Swagger fields
        const response = await api.post('/sessions/', {
            patient_id: payload.patient_id,
            doctor_id: payload.doctor_id,
            appointment_id: payload.appointment_id,
            soap_notes: payload.soap_notes,
            notes: payload.notes,
            treatment_plan: payload.treatment_plan,
            time_duration: payload.time_duration,
            flags_data: payload.flags_data // Swagger says flags_data
        });
        return response.data;
    },

    fetchSessionById: async (session_id) => {
        const response = await api.get(`/sessions/${session_id}`);
        return response.data;
    },

    updateSession: async (session_id, data) => {
        const response = await api.put(`/sessions/${session_id}`, data);
        return response.data;
    },

    deleteSession: async (session_id) => {
        await api.delete(`/sessions/${session_id}/`);
        return session_id;
    },

    fetchTranscript: async (appointment_id) => {
        const response = await api.post(`/sessions/${appointment_id}/fetch-transcript/`);
        return response.data;
    },

    uploadAudio: async (session_id, audioBlob) => {
        const formData = new FormData();
        formData.append('audio_file', audioBlob, `session_${session_id}_audio.webm`);

        const response = await api.post(`/sessions/${session_id}/upload-audio`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    fetchAudioRecordings: async ({ organization_id, doctor_id, patient_id }) => {
        let params = new URLSearchParams();
        if (organization_id) params.append('organization_id', organization_id);
        if (doctor_id) params.append('doctor_id', doctor_id);
        if (patient_id) params.append('patient_id', patient_id);

        const response = await api.get(`/sessions/audio-recordings?${params.toString()}`);
        return response.data;
    },

    fetchPatientHistory: async (patientId) => {
        const response = await api.get(`/sessions/patient/${patientId}/versions`);
        return response.data;
    },

    updateAppointmentStatus: async (appointmentId, status) => {
        const response = await api.patch(`/appointments/${appointmentId}/status`, { status });
        return response.data;
    },
};

export default SessionService;
