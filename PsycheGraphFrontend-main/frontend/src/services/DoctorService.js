import api from './api';

const DoctorService = {
    updateDoctorSchedule: async (doctor_user_id, scheduleData) => {
        try {
            const response = await api.put(`/doctors/${doctor_user_id}/schedule`, scheduleData);
            return response.data;
        } catch (error) {
            console.error('Error updating doctor schedule:', error.response?.data || error);
            throw error;
        }
    },

    getDoctorSchedule: async (doctor_user_id) => {
        try {
            const response = await api.get(`/doctors/${doctor_user_id}/schedule`);
            return response.data;
        } catch (error) {
            console.error('Error fetching doctor schedule:', error.response?.data || error);
            // Return default empty schedule if not found or error
            return null;
        }
    },

    generateAvailabilitySlots: async (doctor_user_id, generationData) => {
        try {
            const response = await api.post(`/doctors/${doctor_user_id}/availability/generate`, generationData);
            return response.data;
        } catch (error) {
            console.error('Error generating availability slots:', error.response?.data || error);
            throw error;
        }
    },

    getDoctorFee: async (doctor_user_id) => {
        try {
            const response = await api.get(`/doctors/${doctor_user_id}/fee`);
            return response.data;
        } catch (error) {
            console.error('Error fetching doctor fee:', error.response?.data || error);
            return null;
        }
    },

    setDoctorFee: async (doctor_user_id, feeData) => {
        try {
            const response = await api.post(`/doctors/${doctor_user_id}/fee`, feeData);
            return response.data;
        } catch (error) {
            console.error('Error setting doctor fee:', error.response?.data || error);
            throw error;
        }
    },

    updateDoctorFee: async (doctor_user_id, feeData) => {
        try {
            const response = await api.put(`/doctors/${doctor_user_id}/fee`, feeData);
            return response.data;
        } catch (error) {
            console.error('Error updating doctor fee:', error.response?.data || error);
            throw error;
        }
    }
};

export default DoctorService;
