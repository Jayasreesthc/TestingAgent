import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import PatientService from '../../services/PatientService';

export const fetchPatients = createAsyncThunk('patients/fetchAll', async (_, { rejectWithValue }) => {
    try {
        return await PatientService.fetchPatients();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch patients');
    }
});

export const fetchPatientById = createAsyncThunk('patients/fetchById', async (id, { rejectWithValue }) => {
    try {
        return await PatientService.fetchPatientById(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch patient details');
    }
});

export const createPatient = createAsyncThunk('patients/create', async (patientData, { rejectWithValue }) => {
    try {
        return await PatientService.createPatient(patientData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create patient');
    }
});

export const updatePatient = createAsyncThunk('patients/update', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await PatientService.updatePatient(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update patient');
    }
});

export const deletePatient = createAsyncThunk('patients/delete', async (id, { rejectWithValue }) => {
    try {
        return await PatientService.deletePatient(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete patient');
    }
});

export const fetchPatientIntake = createAsyncThunk('patients/fetchIntake', async (id, { rejectWithValue }) => {
    try {
        return await PatientService.fetchPatientIntake(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch intake data');
    }
});

export const createPatientIntake = createAsyncThunk('patients/createIntake', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await PatientService.createPatientIntake(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create intake record');
    }
});

export const fetchPatientFile = createAsyncThunk('patients/fetchFile', async (id, { rejectWithValue }) => {
    try {
        return await PatientService.fetchPatientFile(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch patient file');
    }
});

export const updatePatientFile = createAsyncThunk('patients/updateFile', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await PatientService.updatePatientFile(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update patient file');
    }
});

const patientSlice = createSlice({
    name: 'patients',
    initialState: {
        list: [],
        currentPatient: null,
        intakeData: null,
        patientFile: null,
        loading: false,
        intakeLoading: false,
        fileLoading: false,
        error: null,
    },
    reducers: {
        setCurrentPatient: (state, action) => {
            state.currentPatient = action.payload;
        },
        clearSelectedPatient: (state) => {
            state.currentPatient = null;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPatients.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPatients.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchPatients.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchPatientById.pending, (state) => { state.loading = true; state.error = null; state.currentPatient = null; })
            .addCase(fetchPatientById.fulfilled, (state, action) => { state.loading = false; state.currentPatient = action.payload; })
            .addCase(fetchPatientById.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createPatient.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createPatient.fulfilled, (state, action) => { state.loading = false; state.list.unshift(action.payload); })
            .addCase(createPatient.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(updatePatient.fulfilled, (state, action) => {
                const index = state.list.findIndex(p => p.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
                if (state.currentPatient?.id === action.payload.id) state.currentPatient = action.payload;
            })
            .addCase(deletePatient.fulfilled, (state, action) => {
                state.loading = false;
                state.list = state.list.filter(p => String(p.id) !== String(action.payload));
                if (state.currentPatient && String(state.currentPatient.id) === String(action.payload)) {
                    state.currentPatient = null;
                }
            })
            .addCase(deletePatient.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            .addCase(fetchPatientIntake.pending, (state) => { state.intakeLoading = true; })
            .addCase(fetchPatientIntake.fulfilled, (state, action) => { 
                state.intakeLoading = false; 
                state.intakeData = action.payload; 
            })
            .addCase(fetchPatientIntake.rejected, (state) => { 
                state.intakeLoading = false; 
                state.intakeData = null; // Important: Clear if not found
            })

            .addCase(createPatientIntake.pending, (state) => { state.intakeLoading = true; })
            .addCase(createPatientIntake.fulfilled, (state, action) => { 
                state.intakeLoading = false; 
                state.intakeData = action.payload; 
            })
            .addCase(createPatientIntake.rejected, (state, action) => { 
                state.intakeLoading = false; 
                state.error = action.payload; 
            })

            .addCase(fetchPatientFile.pending, (state) => { state.fileLoading = true; })
            .addCase(fetchPatientFile.fulfilled, (state, action) => {
                state.fileLoading = false;
                state.patientFile = action.payload;
            })
            .addCase(fetchPatientFile.rejected, (state) => {
                state.fileLoading = false;
                state.patientFile = null;
            });
    },
});

export const { setCurrentPatient, clearSelectedPatient, clearError } = patientSlice.actions;
export default patientSlice.reducer;
