import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Building2, Plus, Key, Mail, Search, Loader2, X, Check,
    ShieldAlert, Trash2, ChevronLeft, ChevronRight, Stethoscope,
    UserCheck, Users, Phone, Activity, ArrowRight, ArrowLeft, MapPin, User
} from 'lucide-react';
import { fetchOrganizations, createOrganization, deleteOrganization } from '../../store/slices/OrgSlice';
import { fetchUsers, fetchUserById, clearSelectedUser } from '../../store/slices/AllUserSlice';
import { fetchPatients, fetchPatientById, clearSelectedPatient } from '../../store/slices/PatientSlice';
import { motion, AnimatePresence } from 'framer-motion';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function Organizations() {
    const dispatch = useDispatch();
    const { list: organizations, loading } = useSelector((state) => state.organizations);
    const { list: users, loading: userLoading, selectedUser } = useSelector((state) => state.users);
    const { list: patients, loading: patLoading, currentPatient } = useSelector((state) => state.patients);

    // --- Onboard modal ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        license_key: '',
        full_name: '',
        phone_number: '',
        address: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);

    // --- Table search & pagination ---
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    // --- Org-detail modal (click on row) ---
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [activeTab, setActiveTab] = useState('DOCTOR');
    const [innerSearch, setInnerSearch] = useState('');

    // --- User-detail popup (click on user row inside org modal) ---
    const [isFetchingDetail, setIsFetchingDetail] = useState(false);

    useEffect(() => {
        dispatch(fetchOrganizations());
        dispatch(fetchUsers());
        dispatch(fetchPatients());
    }, [dispatch]);

    // Reset fetching state when data arrives
    useEffect(() => {
        if (!userLoading && !patLoading) {
            setIsFetchingDetail(false);
        }
    }, [userLoading, patLoading]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // ---- Org table helpers ----
    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteOrg = async (e, org) => {
        e.stopPropagation(); // prevent row-click
        if (!window.confirm(`Are you sure you want to delete ${org.name}? This action cannot be undone.`)) return;
        setIsDeleting(org.id);
        try {
            await dispatch(deleteOrganization(org.id)).unwrap();
        } catch (error) {
            console.error('Failed to delete organization', error);
            alert('Failed to delete organization: ' + error);
        } finally {
            setIsDeleting(null);
        }
    };

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleAddOrg = async (e) => {
        e.preventDefault();
        if (!validateEmail(formData.email)) { alert('Please enter a valid email address.'); return; }
        setIsSubmitting(true);
        try {
            await dispatch(createOrganization(formData)).unwrap();
            setIsModalOpen(false);
            setFormData({
                name: '',
                email: '',
                license_key: '',
                full_name: '',
                phone_number: '',
                address: ''
            });
        } catch (error) {
            alert(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ---- Org-detail modal helpers ----
    const openOrgDetail = (org) => {
        setSelectedOrg(org);
        setActiveTab('DOCTOR');
        setInnerSearch('');
        dispatch(clearSelectedUser());
        dispatch(clearSelectedPatient());
    };

    const closeOrgDetail = () => {
        setSelectedOrg(null);
        dispatch(clearSelectedUser());
        dispatch(clearSelectedPatient());
        setIsFetchingDetail(false);
    };

    const filteredDetailData = () => {
        if (!selectedOrg) return [];
        let data = [];
        if (activeTab === 'PATIENT') {
            data = patients.filter(p => String(p.organization_id) === String(selectedOrg.id));
        } else {
            data = users.filter(u =>
                String(u.organization_id) === String(selectedOrg.id) &&
                u.role?.toUpperCase() === activeTab
            );
        }
        if (innerSearch) {
            const s = innerSearch.toLowerCase();
            data = data.filter(item =>
                (item.full_name || item.name || item.patient_name || '').toLowerCase().includes(s) ||
                (item.email || '').toLowerCase().includes(s)
            );
        }
        return data;
    };

    const handleUserClick = (item) => {
        setIsFetchingDetail(true);
        if (activeTab === 'PATIENT') {
            dispatch(fetchPatientById(item.id));
        } else {
            dispatch(fetchUserById({ id: item.id, role: item.role }));
        }
    };

    const closeUserDetail = () => {
        dispatch(clearSelectedUser());
        dispatch(clearSelectedPatient());
        setIsFetchingDetail(false);
    };

    const currentDetailList = filteredDetailData();

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
                    <p className="text-sm text-slate-500">Manage clinics and platform licensing</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 whitespace-nowrap"
                >
                    <Plus size={20} />
                    Onboard New Clinic
                </button>
            </div>

            {/* ── Search ── */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search organizations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-900"
                    />
                </div>
            </div>

            {/* ── Organizations Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 whitespace-nowrap">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Organization Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">License Key</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Created At</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(() => {
                                const indexOfLastItem = currentPage * itemsPerPage;
                                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                                const currentItems = filteredOrgs.slice(indexOfFirstItem, indexOfLastItem);

                                if (loading && organizations.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <Loader2 className="animate-spin text-primary-600 mx-auto" size={32} />
                                            </td>
                                        </tr>
                                    );
                                }

                                return currentItems.map((org) => (
                                    <tr
                                        key={org.id}
                                        onClick={() => openOrgDetail(org)}
                                        className="hover:bg-primary-50/50 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                                                    {org.name[0]}
                                                </div>
                                                <span className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{org.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Key size={14} className="text-slate-400" />
                                                {org.license_key}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase ring-1 ring-inset ring-emerald-600/20">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(org.created_at || Date.now()).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={(e) => handleDeleteOrg(e, org)}
                                                disabled={isDeleting === org.id}
                                                title="Delete Organization"
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                {isDeleting === org.id ? (
                                                    <Loader2 size={18} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={18} />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ));
                            })()}
                        </tbody>
                    </table>
                </div>

                {filteredOrgs.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredOrgs.length)} to {Math.min(currentPage * itemsPerPage, filteredOrgs.length)} of {filteredOrgs.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(Math.ceil(filteredOrgs.length / itemsPerPage))].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                            ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300 hover:text-primary-600'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredOrgs.length / itemsPerPage)))}
                                disabled={currentPage === Math.ceil(filteredOrgs.length / itemsPerPage)}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════
                ORG-DETAIL MODAL (click row → show staff/patients)
            ═══════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedOrg && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: 16 }}
                            transition={{ duration: 0.22 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-[#062f3f] to-primary-800">
                                <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-xl bg-white/10 text-white flex items-center justify-center font-black text-lg border border-white/20">
                                        {selectedOrg.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white tracking-tight">{selectedOrg.name}</h3>
                                        <p className="text-xs text-white/50 font-bold uppercase tracking-widest mt-0.5">
                                            <Key size={10} className="inline mr-1" />{selectedOrg.license_key}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeOrgDetail}
                                    className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all"
                                >
                                    <X size={22} />
                                </button>
                            </div>

                            {/* Tab Bar + Inner Search */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 gap-1">
                                    {[
                                        { id: 'DOCTOR', label: 'Practitioners', icon: Stethoscope },
                                        { id: 'RECEPTIONIST', label: 'Receptionists', icon: UserCheck },
                                        // { id: 'PATIENT', label: 'Patients', icon: Users },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => { setActiveTab(tab.id); setInnerSearch(''); }}
                                            className={cn(
                                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
                                                activeTab === tab.id
                                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                            )}
                                        >
                                            <tab.icon size={16} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={innerSearch}
                                        onChange={(e) => setInnerSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-400 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {(userLoading || patLoading) ? (
                                    <div className="flex flex-col items-center justify-center h-60">
                                        <Loader2 className="animate-spin text-primary-500 mb-3" size={36} />
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching records...</p>
                                    </div>
                                ) : currentDetailList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-60 opacity-40">
                                        <Activity size={52} className="mb-4 text-slate-300" />
                                        <p className="text-base font-black text-slate-700">No Records Found</p>
                                        <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
                                            No {activeTab === 'DOCTOR' ? 'practitioner' : activeTab.toLowerCase()}s for this organization
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <AnimatePresence mode="popLayout">
                                            {currentDetailList.map((item, index) => (
                                                <motion.div
                                                    key={item.id}
                                                    initial={{ opacity: 0, x: -12 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 12 }}
                                                    transition={{ delay: index * 0.04 }}
                                                    onClick={() => handleUserClick(item)}
                                                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all cursor-pointer group"
                                                >
                                                    {/* Avatar */}
                                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center border border-white shadow-sm ring-1 ring-slate-200 flex-shrink-0">
                                                        <span className="text-lg font-black text-slate-700">
                                                            {(item.full_name || item.name || item.patient_name || 'U')[0].toUpperCase()}
                                                        </span>
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-slate-800 group-hover:text-primary-700 transition-colors truncate">
                                                            {item.full_name || item.name || item.patient_name || 'Unknown'}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                            {item.email && (
                                                                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                                                    <Mail size={11} /> {item.email}
                                                                </span>
                                                            )}
                                                            {(item.phone_number || item.contact_number) && (
                                                                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                                                    <Phone size={11} /> {item.phone_number || item.contact_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Badge + arrow */}
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase ring-1 ring-inset ring-emerald-600/20">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Active
                                                        </span>
                                                        <div className="p-2 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all">
                                                            <ArrowRight size={16} />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                                    {selectedOrg.name} • PsycheGraph Enterprise
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════
                USER-DETAIL POPUP (click user row inside org modal)
            ═══════════════════════════════════════════════ */}
            <AnimatePresence>
                {(selectedUser || currentPatient || isFetchingDetail) && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#062f3f]/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative"
                        >
                            {/* Back button */}
                            <button
                                onClick={closeUserDetail}
                                className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-500 transition-all z-20 group flex items-center gap-1.5"
                            >
                                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                            </button>

                            {/* Close button */}
                            <button
                                onClick={closeOrgDetail}
                                className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-500 transition-all z-20 group"
                            >
                                <X size={20} className="group-hover:rotate-90 transition-transform" />
                            </button>

                            {isFetchingDetail && !(selectedUser || currentPatient) ? (
                                <div className="h-96 flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="animate-spin text-primary-600" size={40} />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Records...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="h-32 bg-gradient-to-br from-[#062f3f] to-primary-900 relative">
                                        <div className="absolute -bottom-16 left-8 p-1.5 bg-white rounded-3xl shadow-xl">
                                            <div className="h-28 w-28 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl font-black text-primary-600 border border-slate-100 uppercase">
                                                {((selectedUser?.full_name || currentPatient?.full_name || 'U'))[0]}
                                            </div>
                                        </div>
                                        <div className="absolute top-6 left-8">
                                            <div className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full">
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest">
                                                    ID: {selectedUser?.id || currentPatient?.id}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-20 px-8 pb-8 space-y-6">
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-900 leading-tight">
                                                {selectedUser?.full_name || currentPatient?.full_name}
                                            </h2>
                                            <div className="flex items-center gap-3 mt-3">
                                                <span className="px-4 py-1.5 bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl border border-primary-100">
                                                    {selectedUser?.role || 'PATIENT'}
                                                </span>
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all cursor-default">
                                                <div className="p-2.5 bg-white rounded-xl text-slate-400 group-hover:text-primary-500 shadow-sm transition-colors">
                                                    <Mail size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Email</p>
                                                    <p className="font-bold text-slate-700 text-sm truncate">
                                                        {selectedUser?.email || currentPatient?.email || 'Not provided'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all cursor-default">
                                                <div className="p-2.5 bg-white rounded-xl text-slate-400 group-hover:text-primary-500 shadow-sm transition-colors">
                                                    <Building2 size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Organization</p>
                                                    <p className="font-bold text-slate-700 text-sm truncate uppercase tracking-tight">
                                                        {selectedOrg?.name || organizations.find(o => String(o.id) === String(selectedUser?.organization_id || currentPatient?.organization_id))?.name || '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            {(selectedUser?.role === 'DOCTOR' || selectedUser?.role === 'RECEPTIONIST') && (
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all cursor-default">
                                                    <div className="p-2.5 bg-white rounded-xl text-slate-400 group-hover:text-primary-500 shadow-sm transition-colors">
                                                        <Activity size={18} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Clinical Access</p>
                                                        <p className="font-bold text-slate-700 text-sm">Authorized for clinical triage</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Secure Terminal Log</p>
                                            <div className="flex gap-2">
                                                <div className="w-2 h-2 rounded-full bg-slate-200" />
                                                <div className="w-2 h-2 rounded-full bg-slate-200" />
                                                <div className="w-2 h-2 rounded-full bg-primary-500" />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200"
                    >
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Onboard Organization</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Register a new healthcare facility</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-2xl text-slate-400 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddOrg} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Organization Details */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Organization Details</h4>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 ml-1">Clinic Name</label>
                                        <div className="relative group">
                                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                            <input
                                                required type="text" placeholder="Full legal name"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 ml-1">Email Address</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                            <input
                                                required type="email" placeholder="admin@clinic.com"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 ml-1">Address</label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                            <input
                                                required type="text" placeholder="Street, City, State"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Administrative Details */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Administrative Contact</h4>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 ml-1">Admin Full Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                            <input
                                                required type="text" placeholder="Authorized representative"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm outline-none"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 ml-1">Phone Number</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                            <input
                                                required type="tel" placeholder="+91 98765 43210"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm outline-none"
                                                value={formData.phone_number}
                                                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 ml-1">License Key Prefix</label>
                                        <div className="relative group">
                                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                            <input
                                                required type="text" placeholder="e.g. CLINIC-V2-ABC"
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm outline-none uppercase"
                                                value={formData.license_key}
                                                onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-[1.5rem] p-5 flex gap-4 border border-amber-100/50">
                                <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 leading-relaxed font-bold">
                                    Onboarding creates a unique environment. Ensure all legal details are accurate before proceeding to environment generation.
                                </p>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-8 py-4 border-2 border-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] flex items-center justify-center gap-3 bg-primary-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-200 disabled:opacity-70 active:scale-95 text-xs"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                                        <>
                                            Onboard Clinic <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
