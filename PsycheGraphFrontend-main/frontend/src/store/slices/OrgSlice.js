import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import OrgService from '../../services/OrgService';

const formatError = (error) => {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
    }
    if (typeof detail === 'object' && detail !== null) {
        return detail.msg || JSON.stringify(detail);
    }
    return error.response?.data?.message || error.message || 'An unexpected error occurred';
};

export const fetchOrganizations = createAsyncThunk('organizations/fetchAll', async (isPublic = false, { rejectWithValue }) => {
    try {
        return await OrgService.fetchOrganizations(isPublic);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const createOrganization = createAsyncThunk('organizations/create', async (orgData, { rejectWithValue }) => {
    try {
        return await OrgService.createOrganization(orgData);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const updateOrganization = createAsyncThunk('organizations/update', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await OrgService.updateOrganization(id, data);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const deleteOrganization = createAsyncThunk('organizations/delete', async (id, { rejectWithValue }) => {
    try {
        return await OrgService.deleteOrganization(id);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const getWorkingHours = createAsyncThunk('organizations/getWorkingHours', async (org_id, { rejectWithValue }) => {
    try {
        return await OrgService.getWorkingHours(org_id);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return []; // Return empty array if not set yet
        }
        return rejectWithValue(formatError(error));
    }
});

export const setWorkingHours = createAsyncThunk('organizations/setWorkingHours', async ({ org_id, data }, { rejectWithValue }) => {
    try {
        return await OrgService.setWorkingHours(org_id, data);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const fetchHospitalProfile = createAsyncThunk('organizations/fetchHospitalProfile', async (_, { getState, rejectWithValue }) => {
    try {
        const { auth } = getState();
        const org_id = auth.user?.organization_id;
        return await OrgService.getHospitalProfile(org_id);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const updateHospitalProfile = createAsyncThunk('organizations/updateHospitalProfile', async (data, { getState, rejectWithValue }) => {
    try {
        const { auth } = getState();
        const org_id = auth.user?.organization_id;
        return await OrgService.updateHospitalProfile(org_id, data);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

const orgSlice = createSlice({
    name: 'organizations',
    initialState: {
        list: [],
        currentOrg: null,
        workingHours: null,
        loading: false,
        error: null,
    },
    reducers: {
        setCurrentOrg: (state, action) => {
            state.currentOrg = action.payload;
        },
        clearOrgError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOrganizations.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchOrganizations.fulfilled, (state, action) => { 
                state.loading = false; 
                state.list = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchOrganizations.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createOrganization.fulfilled, (state, action) => { state.list.unshift(action.payload); })
            .addCase(updateOrganization.fulfilled, (state, action) => {
                const index = state.list.findIndex(o => o.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
            })
            .addCase(deleteOrganization.fulfilled, (state, action) => {
                state.list = state.list.filter(o => o.id !== action.payload);
            })
            .addCase(getWorkingHours.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(getWorkingHours.fulfilled, (state, action) => {
                state.loading = false;
                state.workingHours = action.payload;
            })
            .addCase(getWorkingHours.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(setWorkingHours.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(setWorkingHours.fulfilled, (state, action) => {
                state.loading = false;
                state.workingHours = action.payload;
            })
            .addCase(setWorkingHours.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchHospitalProfile.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchHospitalProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.currentOrg = action.payload;
            })
            .addCase(fetchHospitalProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateHospitalProfile.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(updateHospitalProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.currentOrg = action.payload;
            })
            .addCase(updateHospitalProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { setCurrentOrg, clearOrgError } = orgSlice.actions;
export default orgSlice.reducer;
