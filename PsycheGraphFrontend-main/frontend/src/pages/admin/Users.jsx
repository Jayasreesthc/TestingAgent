import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, X, Check, Eye, EyeOff, AlertCircle, Info, ChevronLeft, ChevronRight, Search, MoreHorizontal, Users, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchUsers, createUser, updateUser, deleteUser, clearError } from '../../store/slices/AllUserSlice';
import DoctorManageModal from './DoctorManageModal';

// Toast Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border ${type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                }`}
        >
            {type === 'success' ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Check size={18} />
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                    <AlertCircle size={18} />
                </div>
            )}
            <div className="flex flex-col">
                <p className="font-bold text-sm leading-tight">{type === 'success' ? 'Success' : 'Error'}</p>
                <p className="text-xs opacity-90 font-medium mt-0.5">{message}</p>
            </div>
            <button onClick={onClose} className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors">
                <X size={16} />
            </button>
        </motion.div>
    );
};

export default function AdminUsers() {
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: users, loading, error } = useSelector((state) => state.users);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [toast, setToast] = useState(null);
    const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
    const [selectedDoctorForManage, setSelectedDoctorForManage] = useState(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'DOCTOR',
        license_key: '',
        doctor_ids: [],
        description: '',
        phone_number: '',
        address: ''
    });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        dispatch(fetchUsers());
        if (currentUser?.license_key) {
            setFormData(prev => ({ ...prev, license_key: currentUser.license_key }));
        }
        return () => dispatch(clearError());
    }, [dispatch, currentUser]);

    useEffect(() => {
        if (error) {
            showToast(typeof error === 'string' ? error : 'An error occurred', 'error');
            dispatch(clearError());
        }
    }, [error, showToast, dispatch]);

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);

            // Normalize doctor_ids to be an array of integers from multiple possible sources
            let normalizedDoctorIds = [];
            const rawIds = user.assigned_doctors || user.assigned_doctor_user_ids || user.doctor_ids || user.assigned_doctor_ids;

            if (Array.isArray(rawIds)) {
                normalizedDoctorIds = rawIds.map(d => {
                    if (typeof d === 'object' && d !== null) {
                        // Try to find the actual user ID. Sometimes junction IDs are returned instead of user IDs.
                        const id = d.user_id || d.doctor_id || d.id;
                        const name = d.full_name || d.name;

                        // If we have a name but no clear ID, or if the ID might be a junction ID, look it up in users list
                        if (name) {
                            const matchingDoc = users.find(u =>
                                u.role === 'DOCTOR' &&
                                (u.full_name === name || u.name === name)
                            );
                            if (matchingDoc) return parseInt(matchingDoc.id);
                        }
                        return parseInt(id);
                    }
                    return parseInt(d);
                }).filter(id => !isNaN(id));
            } else if (user.doctor_id || user.assigned_doctor_id) {
                normalizedDoctorIds = [parseInt(user.doctor_id || user.assigned_doctor_id)];
            } else if (typeof rawIds === 'string') {
                normalizedDoctorIds = rawIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            }

            setFormData({
                full_name: user.full_name,
                email: user.email,
                password: '',
                role: user.role,
                license_key: user.license_key || currentUser?.license_key || '',
                doctor_ids: normalizedDoctorIds,
                description: user.description || '',
                phone_number: user.phone_number || '',
                address: user.address || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                full_name: '',
                email: '',
                password: '',
                role: 'DOCTOR',
                license_key: currentUser?.license_key || '',
                doctor_ids: [],
                description: '',
                phone_number: '',
                address: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        dispatch(clearError());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.email || !formData.full_name || (!editingUser && !formData.password)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const payload = { ...formData };
        if (editingUser && !payload.password) {
            delete payload.password;
        }

        if (payload.role === 'RECEPTIONIST') {
            const ids = (payload.doctor_ids || []).map(id => parseInt(id)).filter(id => !isNaN(id));
            payload.assigned_doctor_user_ids = ids;
            // Send multiple variations of the key to ensure compatibility with different backend expectations
            payload.doctor_ids = ids;
            payload.assigned_doctor_ids = ids;
        }

        let result;
        if (editingUser) {
            result = await dispatch(updateUser({
                id: editingUser.id,
                data: payload,
                role: editingUser.role
            }));
            if (!result.error) showToast('User updated successfully');
        } else {
            const { role, organization_id, ...cleanPayload } = payload;
            if (role === 'DOCTOR') {
                delete cleanPayload.doctor_id;
                delete cleanPayload.doctor_ids;
            }

            result = await dispatch(createUser({
                role: role,
                userData: cleanPayload
            }));
            if (!result.error) showToast('User created successfully');
        }

        if (!result.error) {
            dispatch(fetchUsers());
            handleCloseModal();
        }
    };

    const handleDelete = async (id, role) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            const result = await dispatch(deleteUser({ id, role }));
            if (!result.error) {
                showToast('User deleted successfully');
                dispatch(fetchUsers());
            }
        }
    };

    // Simulated computation to derive UI state
    const calculateTimeAgo = (dateString) => {
        if (!dateString) return 'Never logged in';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} week${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    const simulateStatusAndTime = (user) => {
        // If this is the currently logged in user, they should always be active and recent
        if (currentUser && user.id === currentUser.id) {
            return { isActive: true, timeAgo: '1 min ago' };
        }

        // We use ID math to ensure consistency across re-renders without hardcoding data
        const isActive = user.id % 3 !== 0; // Simulate ~66% active
        const timeScenarios = ['2 hours ago', '5 hours ago', '1 day ago', '2 weeks ago', '1 month ago'];
        const timeAgo = timeScenarios[user.id % timeScenarios.length];

        return { isActive, timeAgo };
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    // Filtering logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const displayName = user.role === 'DOCTOR' && !user.full_name?.toLowerCase().startsWith('dr') && !user.full_name?.toLowerCase().startsWith('pr')
                ? `Pr. ${user.full_name}`
                : user.full_name;

            const matchesSearch = displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesRole = roleFilter === 'All Roles' ||
                (roleFilter === 'Practitioner' && user.role === 'DOCTOR') ||
                (roleFilter === 'Receptionist' && user.role === 'RECEPTIONIST');

            return matchesSearch && matchesRole;
        });
    }, [users, searchQuery, roleFilter]);

    return (
        <div className="space-y-6">
            <AnimatePresence>
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4"
                >
                    <div className="p-2 border border-slate-200 rounded-lg bg-white hidden md:block">
                        <Users size={20} className="text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-none mb-1">User Management</h2>
                        <p className="text-[13px] text-slate-500 font-medium">Create and manage clinic staff accounts</p>
                    </div>
                </motion.div>
                <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm w-full md:w-auto font-semibold text-sm"
                >
                    <Plus size={16} />
                    Add User
                </motion.button>
            </div>

            {/* Filter Section */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="flex flex-col sm:flex-row gap-4 mb-2"
            >
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#24c4a4]/20 focus:border-[#24c4a4] transition-all placeholder:text-slate-400 text-slate-700 font-medium"
                    />
                </div>

                <div className="relative w-full sm:w-48">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full pl-4 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all text-slate-700 font-medium appearance-none cursor-pointer"
                    >
                        <option value="All Roles">All Roles</option>
                        <option value="Practitioner">Practitioner</option>
                        <option value="Receptionist">Receptionist</option>
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                </div>
            </motion.div>

            {/* Table Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 w-[40%]">User</th>
                                <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 w-[20%]">Role</th>
                                <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 w-[15%]">Status</th>
                                {/* <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 w-[15%]">Last Login</th> */}
                                <th className="px-6 py-4 text-[13px] font-semibold text-slate-500 w-[10%] text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(() => {
                                const indexOfLastItem = currentPage * itemsPerPage;
                                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                                const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

                                if (filteredUsers.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-4 rounded-full bg-slate-50">
                                                        <Search size={28} className="text-slate-300" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-400">No users found matching filters</p>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return currentItems.map((user, index) => {
                                    const isActive = user?.is_active ?? true;
                                    const timeAgo = calculateTimeAgo(user?.last_login_time);

                                    return (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                            onClick={() => handleOpenModal(user)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-indigo-600/10 text-indigo-600 font-bold text-xs flex items-center justify-center border border-indigo-600/20 flex-shrink-0">
                                                        {getInitials(user.full_name)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-[13px] text-slate-800">
                                                            {user.role === 'DOCTOR' && !user.full_name.toLowerCase().startsWith('dr') && !user.full_name.toLowerCase().startsWith('pr') ? `Pr. ${user.full_name}` : user.full_name}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-medium tracking-wide">{user.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`w-fit px-3 py-1 rounded-full text-[11px] font-bold tracking-wide ${user.role === 'DOCTOR' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    {user.role === 'DOCTOR' ? 'Practitioner' : 'Receptionist'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                                                    <span className="text-[13px] text-slate-600 font-medium">
                                                        {isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* <td className="px-6 py-4">
                                                <span className="text-[13px] text-slate-500 font-medium">{timeAgo}</span>
                                            </td> */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {user.role === 'DOCTOR' && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDoctorForManage(user);
                                                                setIsDoctorModalOpen(true);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg transition-all font-bold text-[11px] shadow-sm border border-indigo-100/50"
                                                            title="Manage Availability & Fees"
                                                        >
                                                            <Calendar size={14} />
                                                            <span>Manage</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(user.id, user.role);
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all font-bold text-[11px] shadow-sm border border-red-100/50"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredUsers.length)} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            {[...Array(Math.ceil(filteredUsers.length / itemsPerPage))].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                        ? "bg-indigo-500 text-white shadow-sm"
                                        : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-500 hover:text-indigo-500"
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredUsers.length / itemsPerPage)))}
                                disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCloseModal}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
                        >
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingUser ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                        {editingUser ? <Pencil size={18} /> : <Plus size={18} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{editingUser ? 'Edit User Profile' : 'Register New User'}</h3>
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{editingUser ? 'Update Information' : 'Enter Details Below'}</p>
                                    </div>
                                </div>
                                <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="col-span-2 flex justify-end">
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#24c4a4]/10 focus:border-[#24c4a4] outline-none transition-all text-[13px] font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="Enter Full Name"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-[13px] font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="user@clinic.com"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                                        <input
                                            type="text"
                                            value={formData.phone_number}
                                            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-[13px] font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="Enter Phone Number"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                            {editingUser ? 'New Password (Optional)' : 'Password'}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-[13px] font-bold text-slate-700 placeholder:text-slate-300 pr-12"
                                                placeholder="••••••••"
                                                required={!editingUser}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Address</label>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-[13px] font-bold text-slate-700 placeholder:text-slate-300 min-h-[80px]"
                                            placeholder="Enter complete address..."
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Description / Bio</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-[13px] font-bold text-slate-700 placeholder:text-slate-300 min-h-[80px]"
                                            placeholder="Enter user description or biography..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Role</label>
                                        <select
                                            disabled={!!editingUser}
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all text-[13px] font-bold appearance-none ${editingUser ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-700'}`}
                                        >
                                            <option value="DOCTOR">Practitioner</option>
                                            <option value="RECEPTIONIST">Receptionist</option>
                                        </select>
                                    </div>
                                    {formData.role === 'RECEPTIONIST' && (
                                        <>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assigned Practitioners</label>
                                                <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                                                    {users.filter(u => u.role === 'DOCTOR').map(doctor => {
                                                        const isSelected = formData.doctor_ids.some(id => parseInt(id) === parseInt(doctor.id));
                                                        return (
                                                            <label key={doctor.id} className="flex items-center gap-3 cursor-pointer group">
                                                                <div className="relative flex items-center justify-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={(e) => {
                                                                            const isChecked = e.target.checked;
                                                                            const doctorId = parseInt(doctor.id);
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                doctor_ids: isChecked
                                                                                    ? [...prev.doctor_ids, doctorId]
                                                                                    : prev.doctor_ids.filter(id => parseInt(id) !== doctorId)
                                                                            }));
                                                                        }}
                                                                        className="peer sr-only"
                                                                    />
                                                                    <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center group-hover:border-indigo-500/50 ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white'}`}>
                                                                        <Check size={12} strokeWidth={4} className={`text-white transition-all ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                                                                    </div>
                                                                </div>
                                                                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                                                                    {doctor.full_name}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                    {users.filter(u => u.role === 'DOCTOR').length === 0 && (
                                                        <p className="text-sm text-slate-400 italic py-2">No practitioners available to assign.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="flex-1 px-4 py-3 border border-slate-200 text-slate-500 bg-white rounded-xl hover:bg-slate-50 font-bold tracking-wider uppercase text-xs transition-all shadow-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed font-semibold uppercase text-xs transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (editingUser ? 'Update Information' : 'Add New User')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Doctor Management Modal */}
            <DoctorManageModal
                isOpen={isDoctorModalOpen}
                onClose={() => setIsDoctorModalOpen(false)}
                doctorId={selectedDoctorForManage?.id}
                doctorName={selectedDoctorForManage?.full_name}
            />
        </div>
    );

}
