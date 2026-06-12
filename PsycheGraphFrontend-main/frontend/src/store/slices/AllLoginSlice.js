import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AllLoginService from '../../services/AllLoginService';
import TokenService from '../../token/TokenService';

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

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.login(credentials);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const loginHospital = createAsyncThunk('auth/loginHospital', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.loginHospital(credentials);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const loginDoctor = createAsyncThunk('auth/loginDoctor', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.loginDoctor(credentials);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const loginReceptionist = createAsyncThunk('auth/loginReceptionist', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.loginReceptionist(credentials);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const register = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.register(userData);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const registerHospital = createAsyncThunk('auth/registerHospital', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.registerHospital(userData);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const registerDoctor = createAsyncThunk('auth/registerDoctor', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.registerDoctor(userData);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const registerReceptionist = createAsyncThunk('auth/registerReceptionist', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.registerReceptionist(userData);
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

export const fetchUserProfile = createAsyncThunk('auth/fetchProfile', async (_, { getState, rejectWithValue }) => {
    try {
        const { auth } = getState();
        const user = auth.user;
        if (!user || !user.id) throw new Error("No user ID found");

        const userRole = (user.role || user.user?.role)?.toUpperCase();

        // Dynamic import to avoid circular dependency if any
        const AllUserService = (await import('../../services/AllUserService')).default;
        const profileData = await AllUserService.fetchUserById(user.id, userRole);
        return profileData;
    } catch (error) {
        return rejectWithValue(formatError(error));
    }
});

const AllLoginSlice = createSlice({
    name: 'auth',
    initialState: {
        user: TokenService.getUser(),
        token: TokenService.getLocalAccessToken(),
        refreshToken: TokenService.getLocalRefreshToken(),
        loading: false,
        error: null,
        successMessage: null,
    },
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            state.successMessage = null;
            TokenService.removeUser();
        },
        clearSuccessMessage: (state) => {
            state.successMessage = null;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        const handleAuthFullfilled = (state, action) => {
            const { access_token, refresh_token, token_type, ...userDetails } = action.payload;
            const userRole = (userDetails.role || userDetails.user?.role)?.toUpperCase();
            const portal = action.meta.arg?.portal;

            // Block Super Admin from common portal
            if (portal !== 'admin' && userRole === 'SUPER_ADMIN') {
                state.loading = false;
                state.error = "Access Denied: Super Admins must use the Clinical Operations Portal.";
                state.token = null;
                state.user = null;
                TokenService.removeUser();
                return;
            }

            state.loading = false;
            state.token = action.payload.access_token;
            state.refreshToken = action.payload.refresh_token;
            state.successMessage = "Login successful!";
            state.user = userDetails;

            TokenService.setUser(userDetails);
            TokenService.updateLocalAccessToken(action.payload.access_token);
            if (action.payload.refresh_token) {
                TokenService.updateLocalRefreshToken(action.payload.refresh_token);
            }
        };

        const handleRegisterFullfilled = (state, action) => {
            state.loading = false;
            state.successMessage = action.payload.message || "Registration successful! Please login.";
            state.error = null;
            // We do NOT set user or token here as registration doesn't login automatically
        };

        builder
            // Login Cases
            .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(login.fulfilled, handleAuthFullfilled)
            .addCase(login.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchUserProfile.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchUserProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = { ...state.user, ...action.payload };
                TokenService.setUser(state.user);
            })
            .addCase(fetchUserProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(loginHospital.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(loginHospital.fulfilled, handleAuthFullfilled)
            .addCase(loginHospital.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            // Register Cases
            .addCase(registerHospital.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(registerHospital.fulfilled, handleRegisterFullfilled)
            .addCase(registerHospital.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(register.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(register.fulfilled, handleRegisterFullfilled)
            .addCase(register.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            // Matchers for shared patterns
            .addMatcher(
                (action) => [
                    loginDoctor.pending.type,
                    loginReceptionist.pending.type,
                    registerDoctor.pending.type,
                    registerReceptionist.pending.type
                ].includes(action.type),
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )
            .addMatcher(
                (action) => [
                    loginDoctor.fulfilled.type,
                    loginReceptionist.fulfilled.type
                ].includes(action.type),
                handleAuthFullfilled
            )
            .addMatcher(
                (action) => [
                    registerDoctor.fulfilled.type,
                    registerReceptionist.fulfilled.type
                ].includes(action.type),
                handleRegisterFullfilled
            )
            .addMatcher(
                (action) => [
                    loginDoctor.rejected.type,
                    loginReceptionist.rejected.type,
                    registerDoctor.rejected.type,
                    registerReceptionist.rejected.type
                ].includes(action.type),
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            );
    },
});

export const { logout, clearSuccessMessage, clearError } = AllLoginSlice.actions;
export default AllLoginSlice.reducer;
