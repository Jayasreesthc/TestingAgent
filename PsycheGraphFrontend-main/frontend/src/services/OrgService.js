import api from './api';

const OrgService = {
    fetchOrganizations: async () => {
        const response = await api.get('/admin/organizations');
        // Handle both direct array and { data: [...] } formats
        return Array.isArray(response.data) ? response.data : (response.data?.data || []);
    },

    createOrganization: async (orgData) => {
        const response = await api.post('/admin/organizations/register', orgData);
        return response.data;
    },

    updateOrganization: async (org_id, data) => {
        const response = await api.put(`/admin/organizations/${org_id}`, data);
        return response.data;
    },

    deleteOrganization: async (org_id) => {
        await api.delete(`/admin/organizations/${org_id}`);
        return org_id;
    },

    getWorkingHours: async (org_id) => {
        const response = await api.get(`/organizations/${org_id}/working-hours`);
        return response.data;
    },

    setWorkingHours: async (org_id, data) => {
        const response = await api.put(`/organizations/${org_id}/working-hours`, data);
        return response.data;
    },

    getHospitalProfile: async (org_id) => {
        const response = await api.get('/admin/hospital/profile', {
            params: org_id ? { org_id } : {}
        });
        return response.data;
    },

    updateHospitalProfile: async (org_id, data) => {
        const formData = new FormData();
        if (data.phone_number) formData.append('phone_number', data.phone_number);
        if (data.address) formData.append('address', data.address);
        if (data.logo) formData.append('logo', data.logo);

        const response = await api.put('/admin/hospital/profile', formData, {
            params: org_id ? { org_id } : {},
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    }
};

export default OrgService;
