import { createSlice } from '@reduxjs/toolkit';

// A simple slice to persist UI settings like notifications
const loadSavedSettings = () => {
    try {
        const saved = localStorage.getItem('doctor_notifications');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
    return {
        appointmentReminders: true,
        pendingNotes: true,
        patientUpdates: false
    };
};


const settingsSlice = createSlice({
    name: 'settings',
    initialState: {
        notifications: loadSavedSettings()
    },
    reducers: {
        toggleNotification: (state, action) => {
            const key = action.payload;
            state.notifications[key] = !state.notifications[key];
            try {
                localStorage.setItem('doctor_notifications', JSON.stringify(state.notifications));
            } catch (e) {
                console.error("Failed to save settings", e);
            }
        }
    }
});

export const { toggleNotification } = settingsSlice.actions;
export default settingsSlice.reducer;
