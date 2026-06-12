import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2,
    Users,
    Stethoscope,
    UserCheck,
    Search,
    Loader2,
    ChevronRight,
    Hospital,
    ArrowRight,
    Activity,
    Phone,
    Filter,
    Plus,
    Mail,
    X
} from 'lucide-react';
import { fetchOrganizations } from '../../store/slices/OrgSlice';
import { fetchUsers, fetchUserById, clearSelectedUser } from '../../store/slices/AllUserSlice';
import { fetchPatients, fetchPatientById, clearSelectedPatient, setCurrentPatient } from '../../store/slices/PatientSlice';


const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function HospitalDetails() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list: organizations, loading: orgLoading } = useSelector((state) => state.organizations);
    const { list: users, loading: userLoading, selectedUser } = useSelector((state) => state.users);
    const { list: patients, loading: patLoading, currentPatient } = useSelector((state) => state.patients);

    const [selectedOrgId, setSelectedOrgId] = useState(null);
    const [activeTab, setActiveTab] = useState('DOCTOR'); // DOCTOR, RECEPTIONIST, PATIENT
    const [searchTerm, setSearchTerm] = useState('');
    const [isFetchingDetail, setIsFetchingDetail] = useState(false);

    useEffect(() => {
        dispatch(fetchOrganizations());
        dispatch(fetchUsers());
        dispatch(fetchPatients());
    }, [dispatch]);

    // Reset detail loading state when data arrives or fails
    useEffect(() => {
        if (!userLoading && !patLoading) {
            setIsFetchingDetail(false);
        }
    }, [userLoading, patLoading]);

    // Derived data
    const selectedOrg = organizations.find(o => o.id === selectedOrgId);

    const filteredData = () => {
        if (!selectedOrgId) return [];

        let data = [];
        if (activeTab === 'PATIENT') {
            data = patients.filter(p => String(p.organization_id) === String(selectedOrgId));
        } else {
            data = users.filter(u =>
                String(u.organization_id) === String(selectedOrgId) &&
                u.role?.toUpperCase() === activeTab.toUpperCase()
            );
        }

        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            return data.filter(item => {
                const name = item.full_name || item.name || item.patient_name || '';
                const role = item.role || (activeTab === 'PATIENT' ? 'PATIENT' : '');

                const displayName = role === 'DOCTOR' && !name.toLowerCase().startsWith('dr') && !name.toLowerCase().startsWith('pr')
                    ? `Pr. ${name}`
                    : name;

                return displayName.toLowerCase().includes(lowSearch) ||
                    (item.email || '').toLowerCase().includes(lowSearch);
            });
        }
        return data;
    };

    const currentList = filteredData();

    const handleUserClick = (item) => {
        setIsFetchingDetail(true);
        if (activeTab === 'PATIENT') {
            dispatch(fetchPatientById(item.id));
        } else {
            dispatch(fetchUserById({ id: item.id, role: item.role }));
        }
    };

    const closeUserModal = () => {
        dispatch(clearSelectedUser());
        dispatch(clearSelectedPatient());
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-10 relative"
        >
            {/* User Details Modal */}
            <AnimatePresence>
                {(selectedUser || currentPatient || isFetchingDetail) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#062f3f]/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative"
                        >
                            <button
                                onClick={closeUserModal}
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
                                                    Clinical Resource ID: {selectedUser?.id || currentPatient?.id}
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
                                                    <span className="text-[10px] font-black uppercase tracking-widest">System Online</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all cursor-default">
                                                <div className="p-2.5 bg-white rounded-xl text-slate-400 group-hover:text-primary-500 shadow-sm transition-colors">
                                                    <Mail size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Email Connectivity</p>
                                                    <p className="font-bold text-slate-700 text-sm truncate">{selectedUser?.email || currentPatient?.email || 'Unauthorized'}</p>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all cursor-default">
                                                <div className="p-2.5 bg-white rounded-xl text-slate-400 group-hover:text-primary-500 shadow-sm transition-colors">
                                                    <Building2 size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Assigned Institution</p>
                                                    <p className="font-bold text-slate-700 text-sm truncate uppercase tracking-tight">
                                                        {organizations.find(o => String(o.id) === String(selectedUser?.organization_id || currentPatient?.organization_id))?.name || 'Central Entity'}
                                                    </p>
                                                </div>
                                            </div>

                                            {(selectedUser?.role === 'DOCTOR' || selectedUser?.role === 'RECEPTIONIST') && (
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all cursor-default">
                                                    <div className="p-2.5 bg-white rounded-xl text-slate-400 group-hover:text-primary-500 shadow-sm transition-colors">
                                                        <Activity size={18} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Resource Performance</p>
                                                        <p className="font-bold text-slate-700 text-sm">Authorized for clinical triage</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
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

            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">
                        Hospital <span className="text-transparent bg-clip-text bg-slate-800">Intelligence</span>
                    </h1>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        <Hospital size={18} className="text-primary-500" />
                        Detailed clinical resource management and audit.
                    </p>
                </div>


            </motion.div>

            {/* Hospital Selector (Top) */}
            <motion.div variants={itemVariants} className="space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Select Organization</h3>
                    <div className="hidden sm:block h-px flex-1 bg-slate-200 mx-6" />
                </div>

                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar px-1">
                    {orgLoading ? (
                        <div className="flex items-center gap-2 p-8 text-slate-400">
                            <Loader2 className="animate-spin" size={20} />
                            <span className="font-bold text-xs uppercase">Loading organizations...</span>
                        </div>
                    ) : organizations.map((org) => (
                        <motion.button
                            key={org.id}
                            whileHover={{ y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedOrgId(org.id)}
                            className={cn(
                                "relative flex-shrink-0 min-w-[160px] md:min-w-[200px] p-4 md:p-5 rounded-2xl md:rounded-3xl border-2 transition-all text-left",
                                selectedOrgId === org.id
                                    ? "bg-primary-600 border-primary-600 shadow-xl shadow-primary-500/30 text-white"
                                    : "bg-white border-slate-100 hover:border-primary-200 text-slate-900 shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center font-black mb-4",
                                selectedOrgId === org.id ? "bg-white/20" : "bg-primary-50 text-primary-600"
                            )}>
                                {org.name[0]}
                            </div>
                            <p className="font-black text-sm uppercase tracking-tight truncate">{org.name}</p>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* Details Section */}
            <div className="grid grid-cols-1 gap-8">
                <motion.div
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/80 rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden min-h-[500px] flex flex-col"
                >
                    {/* Toolbar */}
                    <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
                            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                                {[
                                    { id: 'DOCTOR', label: 'Practitioners', icon: Stethoscope },
                                    { id: 'RECEPTIONIST', label: 'Receptionists', icon: UserCheck },
                                    { id: 'PATIENT', label: 'Patients', icon: Users },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 rounded-xl text-sm md:text-base font-black transition-all whitespace-nowrap",
                                            activeTab === tab.id
                                                ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <tab.icon size={20} className="md:w-5 md:h-5" />
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="relative group w-full lg:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder={`Search...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full py-2.5 md:py-3 pl-10 md:pl-12 pr-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-sm md:text-sm font-bold placeholder:text-slate-400 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Content Table */}
                    <div className="flex-1 overflow-x-auto p-2 md:p-4">
                        {!selectedOrgId ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-40">
                                <Building2 size={80} className="mb-6 text-slate-300" />
                                <h3 className="text-2xl font-black text-slate-900 mb-2">No Hospital Selected</h3>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Select an organization above to view details</p>
                            </div>
                        ) : (userLoading || patLoading) ? (
                            <div className="flex flex-col items-center justify-center h-full py-20">
                                <Loader2 className="animate-spin text-primary-500 mb-4" size={40} />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fetching clinical records...</p>
                            </div>
                        ) : currentList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-40">
                                <Activity size={60} className="mb-6 text-slate-300" />
                                <h3 className="text-xl font-black text-slate-900 mb-1">No Records Found</h3>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No {activeTab === 'DOCTOR' ? 'practitioner' : activeTab.toLowerCase()}s registered for this organization.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 px-2 md:px-4 overflow-y-auto max-h-[600px] no-scrollbar">
                                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    <div className="col-span-4">Information</div>
                                    <div className="col-span-4">Contact & Access</div>
                                    <div className="col-span-4 text-right">Details</div>
                                </div>
                                <AnimatePresence mode="popLayout">
                                    {currentList.map((item, index) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ delay: index * 0.05 }}
                                            whileHover={{ x: 5, backgroundColor: 'rgba(248, 250, 252, 0.8)' }}
                                            onClick={() => handleUserClick(item)}
                                            className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 border-slate-50 hover:border-primary-100 transition-all group cursor-pointer"
                                        >
                                            <div className="w-full md:col-span-4 flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-slate-200">
                                                    <span className="text-xl font-black text-slate-900">{(item.full_name || item.name || item.patient_name || 'U')[0]}</span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 uppercase tracking-tight leading-none mb-2 group-hover:text-primary-600 transition-colors">
                                                        {item.role === 'DOCTOR' && !(item.full_name || item.name || '').toLowerCase().startsWith('dr') && !(item.full_name || item.name || '').toLowerCase().startsWith('pr')
                                                            ? `Pr. ${item.full_name || item.name || item.patient_name || 'Unknown User'}`
                                                            : item.full_name || item.name || item.patient_name || 'Unknown User'}
                                                    </p>
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                        ID: {item.id}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="w-full md:col-span-4 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <div className="p-1 rounded-lg bg-slate-50 text-slate-400">
                                                        <Mail size={14} />
                                                    </div>
                                                    {item.email || 'No email provided'}
                                                </div>
                                                {(item.phone_number || item.contact_number) && (
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                        <div className="p-1 rounded-lg bg-slate-50 text-slate-400">
                                                            <Phone size={14} />
                                                        </div>
                                                        {item.phone_number || item.contact_number}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full md:col-span-4 flex items-center justify-between md:justify-end gap-3">
                                                <div className="flex flex-col items-end mr-4">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status</p>
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase">Active</span>
                                                    </div>
                                                </div>
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    className="p-3 rounded-2xl bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all shadow-sm"
                                                >
                                                    <ArrowRight size={20} />
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* Footer Info */}
                    {selectedOrgId && (
                        <div className="p-6 bg-slate-50/80 border-t border-slate-100 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                Verified Data for {selectedOrg?.name} • PsycheGraph Enterprise Docs
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div >
    );
}
