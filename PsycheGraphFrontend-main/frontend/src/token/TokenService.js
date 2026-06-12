import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const TokenService = {
    getLocalRefreshToken() {
        return localStorage.getItem('refreshToken');
    },

    getLocalAccessToken() {
        return localStorage.getItem('token');
    },

    updateLocalAccessToken(token) {
        localStorage.setItem('token', token);
    },

    updateLocalRefreshToken(token) {
        localStorage.setItem('refreshToken', token);
    },

    getUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },

    removeUser() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
    },

    async refreshToken() {
        const refreshToken = this.getLocalRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post(`${API_URL}/auth/token/refresh`, {
                refresh_token: refreshToken
            });

            if (response.data.access_token) {
                this.updateLocalAccessToken(response.data.access_token);
                // If the response also contains a new refresh token, update it too
                if (response.data.refresh_token) {
                    this.updateLocalRefreshToken(response.data.refresh_token);
                }
            }
            return response.data;
        } catch (error) {
            this.removeUser();
            throw error;
        }
    }
};

export default TokenService;
