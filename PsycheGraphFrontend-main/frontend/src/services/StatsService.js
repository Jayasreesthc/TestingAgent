import api from './api';

const StatsService = {
    fetchStats: async () => {
        const response = await api.get('/stats');
        return response.data;
    }
};

export default StatsService;
