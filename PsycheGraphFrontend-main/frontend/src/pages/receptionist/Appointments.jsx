import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAppointments, createAppointment, deleteAppointment, createAvailability, rescheduleAppointment, fetchAvailability } from '../../store/slices/AppointmentSlice';
import { fetchPatients, updatePatient } from '../../store/slices/PatientSlice';
import { fetchUsers, fetchDoctorFee, clearDoctorFee } from '../../store/slices/AllUserSlice';
import { Plus, Calendar as CalendarIcon, Clock, Trash2, X, Loader2, ChevronRight, CheckCircle2, User, ChevronLeft, Stethoscope, MapPin, Wallet, Video, Building, Search, Edit2, RefreshCcw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import api from '../../services/api';
import AppointmentModal from '../../components/AppointmentModal';


function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Global Local Date Helper (YYYY-MM-DD)
const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper for Time Slot
function TimeSlotButton({ slot, selectedSlotId, onClick }) {
    // This component is now managed inside AppointmentModal.jsx
    return null;
}

export default function ReceptionistAppointments() {
    const dispatch = useDispatch();
    const location = useLocation();
    const navigate = useNavigate();
    const { list: appointments, loading, availability } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { list: users, doctorFee } = useSelector((state) => state.users);
    const { user: currentUser } = useSelector((state) => state.auth);

    const [filterTab, setFilterTab] = useState('All'); // 'All', 'Today', 'This Week'
    const [doctorFilter, setDoctorFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        console.log("Fetching Appointments, Patients, Users, and Current Profile...");
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        dispatch(fetchUsers());

        // Dynamic import to avoid dependency issues if fetchUserProfile isn't exported directly
        import('../../store/slices/AllLoginSlice').then(module => {
            if (module.fetchUserProfile) {
                dispatch(module.fetchUserProfile());
            }
        });
    }, [dispatch]);


    const doctors = useMemo(() => {
        // Broad search for assigned doctors in the current user profile (handles nesting and various formats)
        const profileAssignedDoctors =
            currentUser?.assigned_doctors ||
            currentUser?.user?.assigned_doctors ||
            currentUser?.details?.assigned_doctors ||
            currentUser?.doctor?.assigned_doctors;

        if (!Array.isArray(profileAssignedDoctors) || profileAssignedDoctors.length === 0) {
            return [];
        }

        return profileAssignedDoctors.map((d) => {
            const searchName = (d.full_name || d.name || "").toLowerCase().replace(/^dr\.?\s+/i, "").trim();
            const matchingUser = users.find(u => {
                if (u.role !== 'DOCTOR' && !u.is_doctor) return false;
                const uName = (u.full_name || u.name || "").toLowerCase().replace(/^dr\.?\s+/i, "").trim();
                return uName === searchName || String(u.id) === String(d.id) || String(u.user_id) === String(d.id);
            });
            const realDoctorId = matchingUser?.id || matchingUser?.user_id || d.id;
            return {
                id: String(realDoctorId),
                full_name: matchingUser?.full_name || d.full_name || d.name || "Unknown Practitioner",
                role: 'DOCTOR',
                metadata: matchingUser?.description || matchingUser?.metadata || d.metadata
            };
        });
    }, [users, currentUser]);

    const filteredAppointments = useMemo(() => {
        // Initial filter: only show appointments for doctors that the receptionist is assigned to
        const doctorIds = new Set(doctors.map(d => String(d.id)));
        let filtered = appointments.filter(app => doctorIds.has(String(app.doctor_id)));

        // Ensure we have names even if the backend returns raw IDs
        filtered = filtered.map(app => {
            const patient = patients.find(p => String(p.id) === String(app.patient_id));
            const doctor = doctors.find(d => String(d.id) === String(app.doctor_id));
            return {
                ...app,
                patient_name: app.patient_name || patient?.full_name || 'Patient',
                doctor_name: app.doctor_name || doctor?.full_name || (app.doctor_id ? `Practitioner #${app.doctor_id}` : 'Assigned Practitioner')
            };
        });

        // Tab Filtering
        const now = new Date();
        const todayStr = getLocalDateStr(now);

        if (filterTab === 'Today') {
            filtered = filtered.filter(app => {
                const localAppDateStr = getLocalDateStr(app.start_time);
                return localAppDateStr === todayStr;
            });
        } else if (filterTab === 'This Week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0); // Reset to start of Sunday

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7); // Include Saturday and Sunday
            endOfWeek.setHours(23, 59, 59, 999);

            filtered = filtered.filter(app => {
                const appDate = new Date(app.start_time);
                return appDate >= startOfWeek && appDate <= endOfWeek;
            });
        }

        // Doctor Filtering
        if (doctorFilter !== 'All') {
            filtered = filtered.filter(app => String(app.doctor_id) === String(doctorFilter));
        }

        // Search Filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(app =>
                app.patient_name?.toLowerCase().includes(term) ||
                app.doctor_name?.toLowerCase().includes(term)
            );
        }

        return filtered.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    }, [appointments, filterTab, doctorFilter, searchTerm, patients, doctors]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterTab, doctorFilter, searchTerm]);

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);

    // Pagination indices
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);

    const closeModal = () => {
        setIsModalOpen(false);
        setIsRescheduling(false);
        setEditingAppointment(null);
    };

    const handleEditClick = (app) => {
        setEditingAppointment(app);
        setIsRescheduling(true);
        setIsModalOpen(true);
    };

    const handleNewAppointment = () => {
        setIsRescheduling(false);
        setEditingAppointment(null);
        setIsModalOpen(true);
    };

    const getStatusStyle = (status) => {
        switch (status?.toUpperCase()) {
            case 'COMPLETED': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'SCHEDULED':
            case 'CONFIRMED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'CANCELLED': return 'bg-red-50 text-red-600 border-red-100';
            case 'NO-SHOW': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Appointments</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage and schedule patient appointments.</p>
                </div>
                <button
                    onClick={handleNewAppointment}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-[#1b8a77] transition-all shadow-lg shadow-[#21a18c]/20"
                >
                    <CalendarIcon size={18} />
                    <span>New Appointment</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                    {['All', 'Today', 'This Week'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterTab(tab)}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                                filterTab === tab
                                    ? "bg-indigo-500 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={doctorFilter}
                        onChange={(e) => setDoctorFilter(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#21a18c]/20 transition-all min-w-[200px]"
                    >
                        <option value="All">All Practitioners</option>
                        {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>Dr. {doc.full_name}</option>
                        ))}
                    </select>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#21a18c] transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search patient..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#21a18c]/20 transition-all w-full sm:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Patient</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Practitioner</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentItems.map((app) => (
                                <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                {app.patient_name?.[0]}
                                            </div>
                                            <span className="text-sm font-black text-slate-900">{app.patient_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-slate-500">Pr. {app.doctor_name}</span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold whitespace-nowrap">
                                        {getLocalDateStr(app.start_time)}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-900 font-black">
                                        {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={cn(
                                            "px-3 py-1 text-[10px] font-black rounded-full border uppercase tracking-tighter",
                                            getStatusStyle(app.status)
                                        )}>
                                            {app.status === 'SCHEDULED' ? 'Confirmed' : app.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Synced with Users.jsx style) */}
                {filteredAppointments.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAppointments.length)} of {filteredAppointments.length} sessions
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            {[...Array(Math.ceil(filteredAppointments.length / itemsPerPage))].map((_, i) => (
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
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredAppointments.length / itemsPerPage)))}
                                disabled={currentPage === Math.ceil(filteredAppointments.length / itemsPerPage)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {filteredAppointments.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-4 rounded-full bg-slate-50 mb-4">
                            <CalendarIcon size={32} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-black text-slate-400">No appointments found</p>
                        <p className="text-xs text-slate-400 mt-1">Try changing filters or book a new session</p>
                    </div>
                )}
            </div>

            {/* Appointment Modal Component */}
            <AppointmentModal
                isOpen={isModalOpen}
                onClose={closeModal}
                isRescheduling={isRescheduling}
                initialData={editingAppointment}
            />
        </div>
    );
}
