import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import StatsService from '../../services/StatsService';

export const fetchStats = createAsyncThunk('stats/fetch', async (_, { rejectWithValue }) => {
    try {
        return await StatsService.fetchStats();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch statistics');
    }
});

const statsSlice = createSlice({
    name: 'stats',
    initialState: {
        data: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearStats: (state) => {
            state.data = [];
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchStats.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchStats.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
            .addCase(fetchStats.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
    },
});

export const { clearStats } = statsSlice.actions;
export default statsSlice.reducer;
