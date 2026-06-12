import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, createPatient, updatePatient, deletePatient } from '../../store/slices/PatientSlice';
import { fetchDoctors } from '../../store/slices/AllUserSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Users, X, Phone, Mail, Calendar, Loader2, User, ArrowUpRight, MapPin, Activity, Stethoscope, Edit3, Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function ReceptionistPatients() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: allUsers, loading: usersLoading } = useSelector((state) => state.users);
    const { list: appointments } = useSelector((state) => state.appointments);

    const [filterStatus, setFilterStatus] = useState('All');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedPatientProfile, setSelectedPatientProfile] = useState(null);

    // Robust doctor ID and name extraction from currentUser
    const assignedDoctorId = currentUser?.doctor_id || currentUser?.user?.doctor_id ||
        currentUser?.doctor?.id || currentUser?.assigned_doctor_id ||
        currentUser?.details?.doctor_id || currentUser?.user_id;

    const assignedDoctorName = currentUser?.doctor_name || currentUser?.user?.doctor_name ||
        currentUser?.doctor?.name || currentUser?.doctor?.full_name ||
        currentUser?.assigned_doctor_name || currentUser?.assigned_doctor?.full_name ||
        currentUser?.details?.doctor_name;

    const assignedDoctorMeta = currentUser?.doctor?.qualifications || currentUser?.qualifications ||
        currentUser?.details?.qualifications;

    // Search for doctor name in general users list if not in user profile
    const resolvedDoctorName = assignedDoctorName ||
        allUsers.find(u => String(u.user_id || u.id) === String(assignedDoctorId))?.full_name ||
        allUsers.find(u => String(u.user_id || u.id) === String(assignedDoctorId))?.name ||
        (assignedDoctorId ? `Practitioner #${assignedDoctorId.toString().slice(-4)}` : "Assigned Practitioner");

    // Fetch details on mount
    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
        dispatch(fetchDoctors()); // Ensure doctors are specifically fetched
    }, [dispatch]);



    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingPatientId, setEditingPatientId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        contact_number: '',
        date_of_birth: '',
        gender: '',
        address: '',
        organization_id: currentUser?.organization_id || 1
    });

    // Auto-select removed per user request to prevent accidental assignments
    // useEffect(() => {
    //     if (isModalOpen && !isEditMode && displayDoctors.length > 0 && !formData.doctor_id) {
    //         setFormData(prev => ({ ...prev, doctor_id: displayDoctors[0].id }));
    //     }
    // }, [displayDoctors, isModalOpen, isEditMode, formData.doctor_id]);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;



    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const patientPayload = {
                full_name: formData.full_name,
                email: formData.email,
                contact_number: formData.contact_number,
                gender: formData.gender,
                address: formData.address,
                date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString().split('T')[0] : null
            };

            if (isEditMode) {
                // Remove organization_id for updates as it might cause a 500 error
                await dispatch(updatePatient({ id: editingPatientId, data: patientPayload })).unwrap();
                alert('Patient details updated successfully');
            } else {
                await dispatch(createPatient({ ...patientPayload, organization_id: formData.organization_id })).unwrap();
                alert('Patient registered successfully');
            }

            setIsModalOpen(false);
            resetForm();
            dispatch(fetchPatients()); // Refresh list to be sure
        } catch (err) {
            console.error('Operation failed:', err);
            alert(`Failed to ${isEditMode ? 'update' : 'register'} patient`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            full_name: '',
            email: '',
            contact_number: '',
            date_of_birth: '',
            gender: '',
            address: '',
            organization_id: currentUser?.organization_id || 1
        });
        setIsEditMode(false);
        setEditingPatientId(null);
    };

    const handleEditClick = (patient) => {
        setIsEditMode(true);
        setEditingPatientId(patient.id);
        setFormData({
            full_name: patient.full_name || '',
            email: patient.email || '',
            contact_number: patient.contact_number || '',
            date_of_birth: patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : '',
            gender: patient.gender || '',
            address: patient.address || '',
            organization_id: patient.organization_id || currentUser?.organization_id || 1
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (patientId) => {
        if (window.confirm('Are you sure you want to delete this patient record?')) {
            try {
                await dispatch(deletePatient(patientId)).unwrap();
                alert('Patient record deleted successfully');
            } catch (err) {
                console.error('Delete failed:', err);
                alert('Failed to delete patient record');
            }
        }
    };

    const filteredPatients = useMemo(() => {
        return patients.filter(p => {
            const matchesSearch = p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.contact_number?.includes(searchQuery);

            const matchesStatus = filterStatus === 'All' ? true :
                filterStatus === 'Active' ? true : // For now, treat all as active unless we have a 'status' field
                    false; // 'Inactive' would be false for now

            return matchesSearch && matchesStatus;
        });
    }, [patients, searchQuery, filterStatus]);

    // Reset pagination when filter or search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Patients</h2>
                    <p className="text-slate-500 mt-1">Manage patient records and registrations.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1b8a77] transition-all shadow-lg shadow-[#21a18c]/20 w-full sm:w-auto"
                >
                    <UserPlus size={18} />
                    <span>Add Patient</span>
                </motion.button>
            </motion.div>

            {/* Search and Filter Bar */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between"
            >
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search patients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#21a18c]/20 focus:border-[#21a18c] transition-all"
                    />
                </div>

                {/* <div className="flex items-center gap-2 p-1 bg-white border border-slate-100 rounded-xl shadow-sm">
                    {['All', 'Active', 'Inactive'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterStatus(tab)}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                                filterStatus === tab
                                    ? "bg-indigo-500 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div> */}
            </motion.div>

            {/* Patient Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8fafc]">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Address</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Appt</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(() => {
                                const indexOfLastItem = currentPage * itemsPerPage;
                                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                                const currentItems = filteredPatients.slice(indexOfFirstItem, indexOfLastItem);

                                return currentItems.map((patient, index) => {
                                    const patientAppointments = appointments.filter(a => String(a.patient_id) === String(patient.id));
                                    const lastAppt = patientAppointments.sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];

                                    return (
                                        <motion.tr
                                            key={patient.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="hover:bg-slate-50/50 transition-colors group cursor-default"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-900">{patient.full_name}</p>
                                                    {/* <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ID: {patient.id}</span> */}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-500 font-medium">{patient.contact_number}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-500 font-medium">{patient.email}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-500 font-medium truncate max-w-[150px]" title={patient.address}>{patient.address || 'N/A'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-500 font-medium">
                                                    {lastAppt ? new Date(lastAppt.start_time).toISOString().split('T')[0] : 'No record'}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-emerald-100 text-[#21a18c] text-[11px] font-bold rounded-lg uppercase tracking-wider">
                                                    Active
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        onClick={() => handleEditClick(patient)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                                        title="Edit Patient"
                                                    >
                                                        <Edit3 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedPatientProfile(patient); setIsProfileModalOpen(true); }}
                                                        className="p-1.5 text-slate-400 hover:text-[#21a18c] rounded-lg transition-colors"
                                                        title="View Profile"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => navigate('/receptionist/appointments', { state: { schedulePatientId: patient.id } })}
                                                        className="p-1.5 text-slate-400 hover:text-[#21a18c] rounded-lg transition-colors"
                                                        title="Schedule Appointment"
                                                    >
                                                        <Calendar size={18} />
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

                {filteredPatients.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredPatients.length)} to {Math.min(currentPage * itemsPerPage, filteredPatients.length)} of {filteredPatients.length}
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
                                {[...Array(Math.ceil(filteredPatients.length / itemsPerPage))].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                            : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredPatients.length / itemsPerPage)))}
                                disabled={currentPage === Math.ceil(filteredPatients.length / itemsPerPage)}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
                {filteredPatients.length === 0 && !patientsLoading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 rounded-full bg-slate-50 mb-4">
                            <Users size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400">
                            {searchQuery ? 'No patients match your search' : 'No patients found'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            {searchQuery ? 'Try a different search term' : 'Register a new patient to get started'}
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Add Patient Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-indigo-50">
                                        <UserPlus size={18} className="text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">{isEditMode ? 'Edit Patient Details' : 'Register New Patient'}</h3>
                                </div>
                                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            required
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            placeholder="ENTER PATIENT`S FULL NAME"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            required
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="ENTER PATIENT`S EMAIL_ADDRESS"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                required
                                                type="tel"
                                                maxLength={10}
                                                value={formData.contact_number}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                                    if (value.length > 0 && !/^[6-9]/.test(value)) return;
                                                    if (value.length <= 10) {
                                                        setFormData({ ...formData, contact_number: value });
                                                    }
                                                }}
                                                placeholder="8976545686"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                required
                                                type="date"
                                                max={new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]}
                                                value={formData.date_of_birth}
                                                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium"
                                            />
                                        </div>
                                    </div>

                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                                        <div className="relative">
                                            <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <select
                                                required
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium appearance-none"
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>


                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3.5 top-3 text-slate-400" size={16} />
                                        <textarea
                                            required
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="ENTER PATIENT`S ADDRESS"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400 min-h-[100px]"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-3 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setIsModalOpen(false); resetForm(); }}
                                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 flex justify-center items-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (isEditMode ? 'Update Details' : 'Register Patient')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Patient Profile Modal */}
            <AnimatePresence>
                {isProfileModalOpen && selectedPatientProfile && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="px-8 py-6 flex items-center justify-between">
                                <h3 className="text-2xl font-bold text-slate-800">Patient Profile</h3>
                                <button
                                    onClick={() => { setIsProfileModalOpen(false); setSelectedPatientProfile(null); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
                                    <div>
                                        <p className="text-sm font-medium text-slate-400 mb-1">Name:</p>
                                        <p className="text-lg font-bold text-slate-700">{selectedPatientProfile.full_name}</p>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium text-slate-400 mb-1">Gender:</p>
                                        <p className="text-lg font-bold text-slate-700 capitalize">{selectedPatientProfile.gender || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-400 mb-1">Phone:</p>
                                        <p className="text-lg font-bold text-slate-700">{selectedPatientProfile.contact_number}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium text-slate-400 mb-1">Email:</p>
                                        <p className="text-lg font-bold text-slate-700">{selectedPatientProfile.email}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium text-slate-400 mb-1">Address:</p>
                                        <p className="text-lg font-bold text-slate-700 leading-relaxed">
                                            {selectedPatientProfile.address || 'No address provided'}
                                        </p>
                                    </div>
                                </div>

                                {/* Appointment History */}
                                <div className="space-y-4">
                                    <h4 className="text-lg font-bold text-slate-800">Appointment History</h4>
                                    <div className="space-y-3">
                                        {appointments
                                            .filter(a => String(a.patient_id) === String(selectedPatientProfile.id))
                                            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
                                            .slice(0, 5) // Show last 5
                                            .map((appt) => {
                                                const apptDate = new Date(appt.start_time);
                                                return (
                                                    <div key={appt.id} className="flex items-center justify-between p-4 bg-[#f8fafc] rounded-xl border border-slate-100 translate-x-0">
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-sm font-bold text-slate-700">
                                                                {apptDate.toISOString().split('T')[0]} at {apptDate.getHours().toString().padStart(2, '0')}:{apptDate.getMinutes().toString().padStart(2, '0')}
                                                            </p>
                                                        </div>
                                                        <span className={cn(
                                                            "px-3 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider",
                                                            appt.status === 'CONFIRMED' ? "bg-emerald-100 text-[#21a18c]" :
                                                                appt.status === 'COMPLETED' ? "bg-blue-100 text-blue-600" :
                                                                    appt.status === 'CANCELLED' ? "bg-rose-100 text-rose-600" :
                                                                        "bg-slate-100 text-slate-600"
                                                        )}>
                                                            {appt.status}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        {appointments.filter(a => String(a.patient_id) === String(selectedPatientProfile.id)).length === 0 && (
                                            <p className="text-sm text-slate-400 italic">No appointment history found.</p>
                                        )}
                                    </div>
                                </div>

                                {/* <div className="mt-8">
                                    <button className="text-[#21a18c] text-sm font-bold underline hover:text-[#1b8a77] transition-colors">
                                        View Clinical Notes
                                    </button>
                                </div> */}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

