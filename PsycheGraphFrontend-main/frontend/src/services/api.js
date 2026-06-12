import axios from 'axios';
import TokenService from '../token/TokenService';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';
console.log('API Base URL:', API_URL);

const api = axios.create({
    baseURL: API_URL,
    headers: {},
});

// Request interceptor for adding the bearer token
api.interceptors.request.use(
    (config) => {
        const token = TokenService.getLocalAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for handling common errors (like 401 Unauthorized)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (err) => {
        const originalConfig = err.config;

        if (originalConfig.url !== "/auth/token" && err.response) {
            // Access Token was expired
            if (err.response.status === 401 && !originalConfig._retry) {
                originalConfig._retry = true;

                try {
                    const rs = await TokenService.refreshToken();
                    const { access_token } = rs;
                    TokenService.updateLocalAccessToken(access_token);

                    return api(originalConfig);
                } catch (_error) {
                    return Promise.reject(_error);
                }
            }
        }

        return Promise.reject(err);
    }
);

export default api;
