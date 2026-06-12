import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AppointmentService from '../../services/AppointmentService';

export const fetchAppointments = createAsyncThunk('appointments/fetchAll', async (_, { rejectWithValue }) => {
    try {
        return await AppointmentService.fetchAppointments();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch appointments');
    }
});

export const fetchAvailability = createAsyncThunk('appointments/fetchAvailability', async (params, { rejectWithValue }) => {
    try {
        return await AppointmentService.fetchAvailability(params);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch availability');
    }
});

export const createAvailability = createAsyncThunk('appointments/createAvailability', async (slotData, { rejectWithValue }) => {
    try {
        return await AppointmentService.createAvailability(slotData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create availability');
    }
});

export const batchCreateAvailability = createAsyncThunk('appointments/batchCreateAvailability', async (batchData, { rejectWithValue }) => {
    try {
        return await AppointmentService.batchCreateAvailability(batchData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to batch create availability');
    }
});

export const deleteAvailability = createAsyncThunk('appointments/deleteAvailability', async (slotId, { rejectWithValue }) => {
    try {
        return await AppointmentService.deleteAvailability(slotId);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete availability');
    }
});

export const createAppointment = createAsyncThunk('appointments/create', async (appointmentData, { rejectWithValue }) => {
    try {
        return await AppointmentService.createAppointment(appointmentData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create appointment');
    }
});

export const updateAppointment = createAsyncThunk('appointments/update', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await AppointmentService.updateAppointment(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update appointment');
    }
});

export const rescheduleAppointment = createAsyncThunk('appointments/reschedule', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await AppointmentService.rescheduleAppointment(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to reschedule appointment');
    }
});

export const fetchUpdatedAppointments = createAsyncThunk('appointments/fetchUpdated', async (_, { rejectWithValue }) => {
    try {
        return await AppointmentService.fetchUpdatedAppointments();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch updated appointments');
    }
});

export const deleteAppointment = createAsyncThunk('appointments/delete', async (id, { rejectWithValue }) => {
    try {
        return await AppointmentService.deleteAppointment(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete appointment');
    }
});

const appointmentSlice = createSlice({
    name: 'appointments',
    initialState: {
        list: [],
        availability: [],
        updatedList: [], // List of rescheduled appointments for notification
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        dismissNotification: (state, action) => {
            state.updatedList = state.updatedList.filter(app => app.id !== action.payload);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAppointments.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchAppointments.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchAppointments.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createAppointment.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createAppointment.fulfilled, (state, action) => { state.loading = false; state.list.push(action.payload); })
            .addCase(createAppointment.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(updateAppointment.fulfilled, (state, action) => {
                const index = state.list.findIndex(a => a.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
            })
            .addCase(rescheduleAppointment.fulfilled, (state, action) => {
                const index = state.list.findIndex(a => a.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
            })
            .addCase(fetchUpdatedAppointments.fulfilled, (state, action) => {
                state.updatedList = action.payload;
            })
            .addCase(deleteAppointment.fulfilled, (state, action) => {
                state.list = state.list.filter(a => a.id !== action.payload);
            })

            .addCase(fetchAvailability.fulfilled, (state, action) => { state.availability = action.payload; })
            .addCase(createAvailability.fulfilled, (state, action) => { state.availability.push(action.payload); })
            .addCase(batchCreateAvailability.fulfilled, (state, action) => {
                state.availability.push(...action.payload);
            })
            .addCase(deleteAvailability.fulfilled, (state, action) => {
                state.availability = state.availability.filter(a => a.id !== action.payload);
            });
    },
});

export const { clearError, dismissNotification } = appointmentSlice.actions;
export default appointmentSlice.reducer;
