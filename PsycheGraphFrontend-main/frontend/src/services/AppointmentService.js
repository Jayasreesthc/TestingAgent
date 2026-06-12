import api from './api';

const AppointmentService = {
    fetchAppointments: async () => {
        const response = await api.get('/appointments');
        return response.data;
    },

    fetchAvailability: async (params) => {
        const response = await api.get('/appointments/availability', { params });
        return response.data;
    },

    createAvailability: async (slotData) => {
        const response = await api.post('/appointments/availability', slotData);
        return response.data;
    },

    batchCreateAvailability: async (batchData) => {
        const response = await api.post('/appointments/availability/batch', batchData);
        return response.data;
    },

    deleteAvailability: async (slotId) => {
        await api.delete(`/appointments/availability/${slotId}`);
        return slotId;
    },

    deleteAppointment: async (id) => {
        // In the backend, deleting the availability slot cancels the appointment
        await api.delete(`/appointments/availability/${id}`);
        return id;
    },

    createAppointment: async (appointmentData) => {
        const response = await api.post('/appointments/book', appointmentData);
        return response.data;
    },

    rescheduleAppointment: async (appointmentId, data) => {
        const response = await api.post(`/appointments/${appointmentId}/reschedule`, data);
        return response.data;
    },
    fetchUpdatedAppointments: async () => {
        const response = await api.get('/appointments/updated');
        return response.data;
    }
};

export default AppointmentService;
