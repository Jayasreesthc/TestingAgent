import api from './api';

const PractitionerService = {
    updatePractitionerSchedule: async (practitioner_user_id, scheduleData) => {
        try {
            const response = await api.put(`/practitioners/${practitioner_user_id}/schedule`, scheduleData);
            return response.data;
        } catch (error) {
            console.error('Error updating practitioner schedule:', error.response?.data || error);
            throw error;
        }
    },

    getPractitionerSchedule: async (practitioner_user_id) => {
        try {
            const response = await api.get(`/practitioners/${practitioner_user_id}/schedule`);
            return response.data;
        } catch (error) {
            console.error('Error fetching practitioner schedule:', error.response?.data || error);
            // Return default empty schedule if not found or error
            return null;
        }
    },

    generateAvailabilitySlots: async (practitioner_user_id, generationData) => {
        try {
            const response = await api.post(`/practitioners/${practitioner_user_id}/availability/generate`, generationData);
            return response.data;
        } catch (error) {
            console.error('Error generating availability slots:', error.response?.data || error);
            throw error;
        }
    },

    getPractitionerFee: async (practitioner_user_id) => {
        try {
            const response = await api.get(`/practitioners/${practitioner_user_id}/fee`);
            return response.data;
        } catch (error) {
            console.error('Error fetching practitioner fee:', error.response?.data || error);
            return null;
        }
    },

    setPractitionerFee: async (practitioner_user_id, feeData) => {
        try {
            const response = await api.post(`/practitioners/${practitioner_user_id}/fee`, feeData);
            return response.data;
        } catch (error) {
            console.error('Error setting practitioner fee:', error.response?.data || error);
            throw error;
        }
    },

    updatePractitionerFee: async (practitioner_user_id, feeData) => {
        try {
            const response = await api.put(`/practitioners/${practitioner_user_id}/fee`, feeData);
            return response.data;
        } catch (error) {
            console.error('Error updating practitioner fee:', error.response?.data || error);
            throw error;
        }
    }
};

export default PractitionerService;
