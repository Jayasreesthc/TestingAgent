import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AllUserService from '../../services/AllUserService';

export const fetchDoctors = createAsyncThunk('users/fetchDoctors', async (_, { rejectWithValue }) => {
    try {
        return await AllUserService.fetchDoctors();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch doctors');
    }
});

export const fetchReceptionists = createAsyncThunk('users/fetchReceptionists', async (_, { rejectWithValue }) => {
    try {
        return await AllUserService.fetchReceptionists();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch receptionists');
    }
});

export const fetchHospitals = createAsyncThunk('users/fetchHospitals', async (_, { rejectWithValue }) => {
    try {
        return await AllUserService.fetchHospitals();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch hospitals');
    }
});

export const fetchUsers = createAsyncThunk('users/fetchAll', async (_, { rejectWithValue }) => {
    try {
        return await AllUserService.fetchUsers();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch users');
    }
});

export const fetchUserById = createAsyncThunk('users/fetchById', async ({ id, role }, { rejectWithValue }) => {
    try {
        return await AllUserService.fetchUserById(id, role);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch user details');
    }
});

export const createUser = createAsyncThunk('users/create', async ({ role, userData }, { rejectWithValue }) => {
    try {
        return await AllUserService.createUser(role, userData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create user');
    }
});

export const updateUser = createAsyncThunk('users/update', async ({ id, data, role }, { rejectWithValue }) => {
    try {
        return await AllUserService.updateUser(id, data, role);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update user');
    }
});

export const deleteUser = createAsyncThunk('users/delete', async ({ id, role }, { rejectWithValue }) => {
    try {
        return await AllUserService.deleteUser(id, role);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete user');
    }
});

export const fetchDoctorFee = createAsyncThunk('users/fetchDoctorFee', async (doctorUserId, { rejectWithValue }) => {
    try {
        return await AllUserService.fetchDoctorFee(doctorUserId);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch doctor fee');
    }
});

const AllUserSlice = createSlice({
    name: 'users',
    initialState: {
        list: [],
        receptionists: [],
        doctorFee: null,
        selectedUser: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        clearSelectedUser: (state) => {
            state.selectedUser = null;
        },
        clearDoctorFee: (state) => {
            state.doctorFee = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchUsers.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchUsers.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchUserById.pending, (state) => { state.loading = true; state.error = null; state.selectedUser = null; })
            .addCase(fetchUserById.fulfilled, (state, action) => { state.loading = false; state.selectedUser = action.payload; })
            .addCase(fetchUserById.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createUser.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createUser.fulfilled, (state, action) => { state.loading = false; })
            .addCase(createUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(updateUser.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(updateUser.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.list.findIndex(u => u.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
                if (state.selectedUser?.id === action.payload.id) state.selectedUser = action.payload;
            })
            .addCase(updateUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(deleteUser.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(deleteUser.fulfilled, (state, action) => {
                state.loading = false;
                state.list = state.list.filter(u => u.id !== action.payload);
                if (state.selectedUser?.id === action.payload) state.selectedUser = null;
            })
            .addCase(deleteUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchReceptionists.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchReceptionists.fulfilled, (state, action) => { state.loading = false; state.receptionists = action.payload; })
            .addCase(fetchReceptionists.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchDoctorFee.pending, (state) => { state.error = null; })
            .addCase(fetchDoctorFee.fulfilled, (state, action) => { state.doctorFee = action.payload; })
            .addCase(fetchDoctorFee.rejected, (state, action) => { state.error = action.payload; })

            .addMatcher(
                (action) => [fetchDoctors.pending.type, fetchHospitals.pending.type].includes(action.type),
                (state) => { state.loading = true; state.error = null; }
            )
            .addMatcher(
                (action) => [fetchDoctors.fulfilled.type, fetchHospitals.fulfilled.type].includes(action.type),
                (state, action) => { state.loading = false; state.list = action.payload; }
            )
            .addMatcher(
                (action) => [fetchDoctors.rejected.type, fetchHospitals.rejected.type].includes(action.type),
                (state, action) => { state.loading = false; state.error = action.payload; }
            );
    },
});

export const { clearError, clearSelectedUser, clearDoctorFee } = AllUserSlice.actions;
export default AllUserSlice.reducer;
