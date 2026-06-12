import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/AllLoginSlice';
import patientReducer from './slices/PatientSlice';
import sessionReducer from './slices/SessionSlice';
import orgReducer from './slices/OrgSlice';
import userReducer from './slices/AllUserSlice';
import appointmentReducer from './slices/AppointmentSlice';
import statsReducer from './slices/StatsSlice';
import settingsReducer from './slices/SettingsSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        patients: patientReducer,
        sessions: sessionReducer,
        organizations: orgReducer,
        users: userReducer,
        appointments: appointmentReducer,
        stats: statsReducer,
        settings: settingsReducer,
    },
});

export default store;

