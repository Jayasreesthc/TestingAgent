import { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAppointments, createAppointment, deleteAppointment, rescheduleAppointment, fetchAvailability } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import {
    Calendar as CalendarIcon,
    Clock,
    Plus,
    X,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Search,
    User,
    Video,
    Phone,
    Mail,
    Info,
    Calendar,
    Activity,
    MapPin,
    History,
    ClipboardList,
    ChevronDown,
    Filter,
    Layers
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AppointmentModal from '../../components/AppointmentModal';

const cn = (...inputs) => twMerge(clsx(inputs));

// Helper for local date string (YYYY-MM-DD)
const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function DoctorAppointments() {
    const dispatch = useDispatch();
    const { list: rawAppointments, availability, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const user = useSelector((state) => state.auth?.user || state.login?.user);

    const [tabMode, setTabMode] = useState('Calendar View'); // 'Calendar View' or 'List View'
    const [view, setView] = useState('Weekly'); // 'Daily', 'Weekly', 'Monthly'
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const viewDropdownRef = useRef(null);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('time'); // 'time' or 'patient'

    const [calendarFilter, setCalendarFilter] = useState('all'); // 'all' | 'scheduled' | 'free'
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef(null);

    // Outside click detection
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target)) {
                setIsViewDropdownOpen(false);
            }
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Shared AppointmentModal states
    const [isSharedModalOpen, setIsSharedModalOpen] = useState(false);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [activePatientTab, setActivePatientTab] = useState('profile');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Resolve doctor ID
    const doctorId = user?.id || user?.user?.id || user?.doctor_id || '';
    const doctorName = user?.full_name || user?.user?.full_name || user?.name || 'Practitioner';
    // Build a doctor override object to pass to AppointmentModal (bypasses receptionist assigned_doctors)
    const doctorOverrideObj = doctorId ? { id: String(doctorId), full_name: doctorName, role: 'DOCTOR' } : null;

    // Initial data fetch — always needed
    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
    }, [dispatch]);

    // Fetch availability scoped to this practitioner as soon as doctorId resolves
    useEffect(() => {
        if (!doctorId) return;
        dispatch(fetchAvailability({ doctor_id: doctorId }));
    }, [dispatch, doctorId]);

    // Map appointments to resolve patient names and filter for current doctor
    const mappedAppointments = useMemo(() => {
        let filtered = rawAppointments.map(app => {
            const patient = patients.find(p => String(p.id) === String(app.patient_id));
            return {
                ...app,
                patient_name: app.patient_name || patient?.full_name || 'Patient'
            };
        });

        // Strictly filter by current doctor's ID
        if (doctorId) {
            filtered = filtered.filter(app => String(app.doctor_id) === String(doctorId));
        }

        // Search filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(app => {
                const pName = app.patient_name.toLowerCase();
                return pName.includes(term);
            });
        }

        // Sorting
        if (sortOrder === 'patient') {
            filtered.sort((a, b) => a.patient_name.localeCompare(b.patient_name));
        } else {
            filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        }

        return filtered;
    }, [rawAppointments, patients, searchTerm, doctorId, sortOrder]);

    // Unified slots logic: Map Availability records to Appointments
    const unifiedSlots = useMemo(() => {
        if (!doctorId) return [];
        
        // Filter doctor's availability
        const doctorAvailability = availability.filter(slot => String(slot.doctor_id) === String(doctorId));
        
        return doctorAvailability.map(slot => {
            // Find appointment linked to this slot
            const app = rawAppointments.find(a => 
                (String(a.availability_id) === String(slot.id)) || 
                (getLocalDateStr(a.start_time) === getLocalDateStr(slot.start_time) && 
                 new Date(a.start_time).getTime() === new Date(slot.start_time).getTime())
            );

            const patient = app ? patients.find(p => String(p.id) === String(app.patient_id)) : null;

            return {
                ...slot,
                appointment: app,
                patient_name: patient?.full_name || app?.patient_name || 'Patient',
                is_booked: slot.is_booked || !!app,
                status: app?.status || 'AVAILABLE'
            };
        });
    }, [availability, rawAppointments, doctorId, patients]);

    // Filtered calendar slots: combines unifiedSlots (availability-based) with
    // standalone appointments that may not have an availability record
    const filteredCalendarSlots = useMemo(() => {
        // Build unified slots (availability-linked)
        const slotIds = new Set(unifiedSlots.map(s => s.id));
        
        // Find appointments that are NOT linked to any availability record
        const standaloneApps = mappedAppointments
            .filter(app => !unifiedSlots.some(s =>
                (s.appointment && String(s.appointment.id) === String(app.id))
            ))
            .map(app => ({
                id: `standalone-${app.id}`,
                start_time: app.start_time,
                appointment: app,
                patient_name: app.patient_name,
                is_booked: true,
                status: app.status,
                _isStandalone: true
            }));

        let combined;
        if (calendarFilter === 'scheduled') {
            // Only booked slots + standalone appointments
            combined = [
                ...unifiedSlots.filter(s => s.is_booked || s.appointment),
                ...standaloneApps
            ];
        } else if (calendarFilter === 'free') {
            // Only unbooked availability slots
            combined = unifiedSlots.filter(s => !s.is_booked && !s.appointment);
        } else {
            // All: full unified slots + standalone appointments
            combined = [...unifiedSlots, ...standaloneApps];
        }

        return combined.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }, [unifiedSlots, mappedAppointments, calendarFilter]);

    const startOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - (day === 0 ? 6 : day - 1); // Monday start
        const result = new Date(d.setDate(diff));
        result.setHours(0, 0, 0, 0);
        return result;
    };

    const getDaysInWeek = (date) => {
        const start = startOfWeek(new Date(date));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    };

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
        const days = [];
        for (let i = startPadding - 1; i >= 0; i--) days.push(new Date(year, month, -i));
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) days.push(new Date(year, month + 1, i));
        return days;
    };

    const weekDays = useMemo(() => getDaysInWeek(currentDate), [currentDate]);
    const monthDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);
    const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 06:00 to 20:00

    const formatRange = () => {
        if (view === 'Daily') return currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (view === 'Monthly') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const start = weekDays[0];
        const end = weekDays[6];
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    const navigateDate = (direction) => {
        const newDate = new Date(currentDate);
        if (view === 'Weekly') newDate.setDate(currentDate.getDate() + (direction * 7));
        else if (view === 'Daily') newDate.setDate(currentDate.getDate() + direction);
        else if (view === 'Monthly') newDate.setMonth(currentDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const resetToToday = () => setCurrentDate(new Date());

    const handleEditClick = (app) => {
        setSelectedAppointment(app);
        setIsRescheduling(true);
        setIsSharedModalOpen(true);
    };

    const handleNewClick = () => {
        setSelectedAppointment(null);
        setIsRescheduling(false);
        setIsSharedModalOpen(true);
    };

    // --- Renderers ---
    const renderDailyView = () => {
        const todayStr = getLocalDateStr(currentDate);
        const daySlots = filteredCalendarSlots.filter(slot => getLocalDateStr(slot.start_time) === todayStr);

        return (
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                <div className="min-w-full">
                    {hours.map((hour) => {
                        const timeString = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                        const hourSlots = daySlots.filter(slot => {
                            const d = new Date(slot.start_time);
                            return d.getHours() === hour;
                        });

                        return (
                            <div key={hour} className="group flex border-b border-slate-50 min-h-[100px] relative">
                                <div className="w-24 py-4 px-4 text-[10px] font-black text-slate-400 border-r border-slate-50 shrink-0 uppercase tracking-tighter">
                                    {timeString}
                                </div>
                                <div className="flex-1 p-2 flex flex-wrap gap-3">
                                    {hourSlots.length > 0 ? hourSlots.map(slot => (
                                        slot.appointment ? (
                                            <div
                                                key={slot.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditClick(slot.appointment);
                                                }}
                                                className={cn(
                                                    "h-fit min-w-[240px] flex-1 p-4 rounded-2xl shadow-sm border-l-4 transition-all hover:shadow-md cursor-pointer active:scale-[0.98] group/card relative",
                                                    slot.appointment.booking_type === 'online' ? "bg-indigo-50 border-l-indigo-500" : "bg-emerald-50 border-l-emerald-500"
                                                )}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase">
                                                            {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Booked Slot</span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[8px] font-black px-2 py-0.5 rounded-full uppercase",
                                                        slot.appointment.status === 'SCHEDULED' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                                    )}>
                                                        {slot.appointment.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-900 line-clamp-1">{slot.patient_name}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {slot.appointment.booking_type === 'online' && <Video size={12} className="text-indigo-500" />}
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{slot.appointment.booking_type || 'offline'} Visit</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div 
                                                key={slot.id}
                                                onClick={() => {
                                                    setSelectedAppointment({ start_time: slot.start_time, availability_id: slot.id });
                                                    setIsRescheduling(false);
                                                    setIsSharedModalOpen(true);
                                                }}
                                                className="h-fit min-w-[240px] flex-1 p-4 rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer group/empty flex flex-col justify-center"
                                            >
                                                <div className="flex items-center gap-2 text-indigo-400 group-hover/empty:text-indigo-600">
                                                    <Plus size={16} />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Availability Slot</span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Ready to Book</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    )) : (
                                        calendarFilter === 'all' ? (
                                            <div className="flex-1 flex items-center justify-center opacity-20 select-none cursor-not-allowed">
                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Closed Slot</span>
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeeklyView = () => (
        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 overflow-hidden bg-white">
            {weekDays.map((day, i) => {
                const dayStr = getLocalDateStr(day);
                const daySlots = filteredCalendarSlots.filter(s => getLocalDateStr(s.start_time) === dayStr);
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                    <div key={i} className={cn("flex flex-col min-h-0", isToday && "bg-indigo-50/30")}>
                        <div className={cn("p-4 border-b text-center", isToday ? "bg-indigo-50/50" : "bg-slate-50/30")}>
                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isToday ? "text-indigo-500" : "text-slate-400")}>
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className={cn("text-xl font-black", isToday ? "text-indigo-600" : "text-slate-900")}>{day.getDate()}</p>
                            {daySlots.length > 0 && (
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    <span className="text-emerald-500">{daySlots.filter(s => s.appointment).length} booked</span>
                                    {calendarFilter !== 'scheduled' && <span className="text-indigo-400"> · {daySlots.filter(s => !s.appointment).length} free</span>}
                                </p>
                            )}
                        </div>
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                            {daySlots.length > 0 ? daySlots.map(slot => (
                                slot.appointment ? (
                                    <div 
                                        key={slot.id} 
                                        onClick={(e) => { e.stopPropagation(); handleEditClick(slot.appointment); }}
                                        className={cn(
                                            "p-2.5 rounded-xl border border-slate-100 border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]",
                                            slot.appointment.booking_type === 'online' ? "border-l-indigo-500 bg-indigo-50/50" : "border-l-emerald-500 bg-emerald-50/50"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">
                                                {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <span className={cn(
                                                "text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase",
                                                slot.appointment.status === 'SCHEDULED' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                            )}>{slot.appointment.status}</span>
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-1">{slot.patient_name}</p>
                                        {slot.appointment.booking_type === 'online' && <div className="mt-1 flex items-center gap-1 text-indigo-500 font-bold text-[8px] uppercase"><Video size={10} /> Video</div>}
                                    </div>
                                ) : (
                                    <div 
                                        key={slot.id}
                                        onClick={() => {
                                            setSelectedAppointment({ start_time: slot.start_time, availability_id: slot.id });
                                            setIsRescheduling(false);
                                            setIsSharedModalOpen(true);
                                        }}
                                        className="p-2.5 rounded-xl border-2 border-dashed border-indigo-100 bg-indigo-50/10 hover:bg-indigo-50 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[8px] font-black text-indigo-400 uppercase">
                                                {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <Plus size={8} className="text-indigo-300" />
                                        </div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-tighter">Available</p>
                                    </div>
                                )
                            )) : (
                                <div className="flex-1 flex items-center justify-center h-full py-8">
                                    <p className="text-[8px] font-black text-slate-200 uppercase tracking-widest">No Slots</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );


    const renderMonthlyView = () => (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-100">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                ))}
            </div>
            <div className="flex-1 grid grid-cols-7 divide-x divide-y divide-slate-100 overflow-hidden">
                {monthDays.map((day, i) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const dayStr = getLocalDateStr(day);
                    const daySlots = filteredCalendarSlots.filter(s => getLocalDateStr(s.start_time) === dayStr);
                    const bookedSlots = daySlots.filter(s => s.appointment);
                    const freeSlots = daySlots.filter(s => !s.appointment);
                    const isToday = day.toDateString() === new Date().toDateString();

                    return (
                        <div key={i} className={cn("p-1.5 flex flex-col min-h-[90px] relative", !isCurrentMonth && "bg-slate-50/50", isToday && "bg-indigo-50/30")}>
                            <div className="flex items-center justify-between mb-1">
                                <span className={cn(
                                    "text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl",
                                    !isCurrentMonth ? "text-slate-300" : isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-700"
                                )}>
                                    {day.getDate()}
                                </span>
                                {freeSlots.length > 0 && calendarFilter !== 'scheduled' && (
                                    <span className="text-[7px] font-black text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                        {freeSlots.length} free
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 space-y-1 overflow-hidden">
                                {bookedSlots.slice(0, 3).map(slot => (
                                    <div 
                                        key={slot.id} 
                                        onClick={(e) => { e.stopPropagation(); handleEditClick(slot.appointment); }}
                                        className={cn(
                                            "px-2 py-1.5 text-[10px] font-bold rounded-lg border cursor-pointer hover:opacity-80 transition-opacity shadow-sm",
                                            slot.appointment.booking_type === 'online' ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-emerald-50 text-emerald-800 border-emerald-100"
                                        )}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] opacity-80">{new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {slot.appointment.booking_type === 'online' && <span className="text-[8px] animate-pulse text-indigo-500">●</span>}
                                            </div>
                                            <div className="truncate leading-tight font-black">{slot.patient_name}</div>
                                        </div>
                                    </div>
                                ))}
                                {calendarFilter !== 'scheduled' && freeSlots.slice(0, calendarFilter === 'free' ? 3 : 1).map(slot => (
                                    <div
                                        key={slot.id}
                                        onClick={() => {
                                            setSelectedAppointment({ start_time: slot.start_time, availability_id: slot.id });
                                            setIsRescheduling(false);
                                            setIsSharedModalOpen(true);
                                        }}
                                        className="px-2 py-1 text-[9px] font-bold rounded-lg border-2 border-dashed border-indigo-100 text-indigo-400 cursor-pointer hover:bg-indigo-50 transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={8} />
                                        <span>{new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                ))}
                                {bookedSlots.length > 3 && <p className="text-[8px] font-black text-slate-400 pl-1">+{bookedSlots.length - 3} more</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto pb-20 pt-4 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Schedule</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage your patient appointments and consultations.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* tabMode Toggle */}
                    <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
                        {['Calendar View', 'List View'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setTabMode(m)}
                                className={cn(
                                    "px-5 py-2 text-xs font-black rounded-xl transition-all duration-300 uppercase tracking-widest",
                                    tabMode === m ? "bg-white text-slate-900 shadow-lg" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                )}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleNewClick}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Plus size={16} strokeWidth={3} /> New Appointment
                    </button>
                </div>
            </div>

            {tabMode === 'Calendar View' ? (
                <div className="space-y-4">
                    {/* Unified Control Bar */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex-wrap">
                        {/* View Mode Dropdown */}
                        <div className="relative" ref={viewDropdownRef}>
                            <button
                                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                                className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white hover:border-indigo-400 transition-all shadow-sm"
                            >
                                <Layers size={14} className="text-indigo-600" />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">View</span>
                                    <span className="text-xs font-bold text-slate-800">{view}</span>
                                </div>
                                <ChevronDown size={16} className={cn("text-slate-400 transition-transform duration-300", isViewDropdownOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {isViewDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute left-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-2"
                                    >
                                        {['Daily', 'Weekly', 'Monthly'].map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => {
                                                    setView(v);
                                                    setIsViewDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest",
                                                    view === v ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                                                )}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Filter Dropdown */}
                        <div className="relative" ref={filterDropdownRef}>
                            <button
                                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white hover:border-indigo-400 transition-all shadow-sm"
                            >
                                <Filter size={14} className="text-indigo-500" />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Filter</span>
                                    <span className="text-xs font-bold text-slate-800 capitalize">
                                        {calendarFilter === 'all' ? 'All' : calendarFilter === 'scheduled' ? 'Booked' : 'Free'}
                                    </span>
                                </div>
                                <ChevronDown size={16} className={cn("text-slate-400 transition-transform duration-300", isFilterDropdownOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {isFilterDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-2 overflow-hidden"
                                    >
                                        {[
                                            { key: 'all', label: 'All Slots', icon: '◈', color: 'text-slate-600', bg: 'hover:bg-slate-50' },
                                            { key: 'scheduled', label: 'Scheduled', icon: '●', color: 'text-emerald-600', bg: 'hover:bg-emerald-50/50' },
                                            { key: 'free', label: 'Free Slots', icon: '○', color: 'text-indigo-500', bg: 'hover:bg-indigo-50/50' },
                                        ].map(f => (
                                            <button
                                                key={f.key}
                                                onClick={() => {
                                                    setCalendarFilter(f.key);
                                                    setIsFilterDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-xs font-bold",
                                                    calendarFilter === f.key ? "bg-indigo-600 text-white" : cn("text-slate-600", f.bg)
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={cn("text-sm", calendarFilter === f.key ? 'text-white' : f.color)}>{f.icon}</span>
                                                    {f.label}
                                                </div>
                                                <span className={cn(
                                                    "text-[9px] px-2 py-0.5 rounded-full font-black",
                                                    calendarFilter === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {f.key === 'all'
                                                        ? filteredCalendarSlots.length
                                                        : f.key === 'scheduled'
                                                            ? filteredCalendarSlots.filter(s => s.appointment).length
                                                            : filteredCalendarSlots.filter(s => !s.appointment).length
                                                    }
                                                </span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="ml-auto flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Appointment</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 border-2 border-dashed border-indigo-300 inline-block"></span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Free Slot</span>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Control Bar */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-start gap-4">
                            <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronLeft size={20} /></button>
                                <button onClick={() => navigateDate(1)} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronRight size={20} /></button>
                            </div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight min-w-[200px] text-center">{formatRange()}</h2>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button onClick={resetToToday} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">Today</button>
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-11 pr-5 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 w-48 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Main Calendar Area */}
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={view + currentDate.toISOString()}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex-1 flex flex-col min-h-0"
                            >
                                {view === 'Daily' && renderDailyView()}
                                {view === 'Weekly' && renderWeeklyView()}
                                {view === 'Monthly' && renderMonthlyView()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            ) : (
                /* List View */
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <button 
                                            onClick={() => setSortOrder(sortOrder === 'patient' ? 'time' : 'patient')}
                                            className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                                        >
                                            Patient {sortOrder === 'patient' && <ChevronRight size={10} className="rotate-90" />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <button 
                                            onClick={() => setSortOrder('time')}
                                            className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                                        >
                                            Date & Time {sortOrder === 'time' && <ChevronRight size={10} className="rotate-90" />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visit Type</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mappedAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(app => (
                                    <tr 
                                        key={app.id} 
                                        onClick={() => handleEditClick(app)}
                                        className="hover:bg-slate-50/50 group cursor-pointer"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs uppercase">{app.patient_name[0]}</div>
                                                <p className="text-sm font-bold text-slate-900">{app.patient_name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-slate-700">{new Date(app.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                <p className="text-xs text-slate-400 font-medium">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={cn(
                                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                                app.booking_type === 'online' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                            )}>
                                                {app.booking_type || 'offline'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className={cn(
                                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                                app.status === 'SCHEDULED' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {app.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="p-6 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page {currentPage} of {Math.ceil(mappedAppointments.length / itemsPerPage)}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"><ChevronLeft size={20} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(mappedAppointments.length / itemsPerPage), p + 1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                </div>
            )}

            <AppointmentModal
                isOpen={isSharedModalOpen}
                onClose={() => {
                    setIsSharedModalOpen(false);
                    if (doctorId) {
                        dispatch(fetchAvailability({ doctor_id: doctorId }));
                    }
                }}
                isRescheduling={isRescheduling}
                initialData={selectedAppointment}
                doctorOverride={isRescheduling ? null : doctorOverrideObj}
            />

            {/* Patient Details Modal */}
            <AnimatePresence>
                {isPatientModalOpen && selectedPatient && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative border border-slate-100"
                        >
                            {/* Decorative Background */}
                            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600 to-primary-500 opacity-10" />

                            <div className="relative p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-primary-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-200">
                                            {selectedPatient.full_name?.[0] || 'P'}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedPatient.full_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg uppercase">Patient ID #{selectedPatient.id || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsPatientModalOpen(false);
                                            setActivePatientTab('profile');
                                        }}
                                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-8 w-fit mx-auto">
                                    {[
                                        { id: 'profile', label: 'Profile', icon: User },
                                        { id: 'history', label: 'History', icon: History }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActivePatientTab(tab.id)}
                                            className={cn(
                                                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                activePatientTab === tab.id 
                                                    ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100" 
                                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                                            )}
                                        >
                                            <tab.icon size={14} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {activePatientTab === 'profile' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Age</p>
                                                <p className="text-sm font-black text-slate-700">{selectedPatient.age || 'N/A'} Years</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gender</p>
                                                <p className="text-sm font-black text-slate-700 capitalize">{selectedPatient.gender || 'N/A'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Contact Details ... existing code ... */}
                                    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                            <Phone size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                                            <a href={`tel:${selectedPatient.contact_number}`} className="text-sm font-bold text-slate-700 hover:text-indigo-600">{selectedPatient.contact_number || 'N/A'}</a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                            <MapPin size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</p>
                                            <p className="text-sm font-bold text-slate-700">{selectedPatient.address || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                                            <a href={`mailto:${selectedPatient.email}`} className="text-sm font-bold text-slate-700 hover:text-indigo-600 truncate max-w-[200px] block">{selectedPatient.email || 'N/A'}</a>
                                        </div>
                                    </div>

                                            {selectedPatient.blood_group || selectedPatient.height || selectedPatient.weight ? (
                                                <div className="pt-4 border-t border-slate-100 flex items-center gap-6">
                                                    {selectedPatient.blood_group && (
                                                        <div className="flex items-center gap-2">
                                                            <Activity size={14} className="text-rose-500" />
                                                            <span className="text-xs font-bold text-slate-600 capitalize">{selectedPatient.blood_group}</span>
                                                        </div>
                                                    )}
                                                    {selectedPatient.height && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">H:</span>
                                                            <span className="text-xs font-bold text-slate-600 uppercase">{selectedPatient.height}</span>
                                                        </div>
                                                    )}
                                                    {selectedPatient.weight && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">W:</span>
                                                            <span className="text-xs font-bold text-slate-600 uppercase">{selectedPatient.weight}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                                        <PatientHistoryView patientId={selectedPatient.id} />
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        setIsPatientModalOpen(false);
                                        setActivePatientTab('profile');
                                    }}
                                    className="w-full mt-8 py-4 bg-[#012939] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-xs"
                                >
                                    Close Details
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Sub-component for Patient History logic to keep Appointments.jsx cleaner
function PatientHistoryView({ patientId }) {
    const dispatch = useDispatch();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            if (!patientId) return;
            setIsLoading(true);
            try {
                const { fetchSessions } = await import('../../store/slices/SessionSlice');
                const result = await dispatch(fetchSessions(patientId)).unwrap();
                setHistory(result || []);
            } catch (err) {
                console.error("Failed to load patient history:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadHistory();
    }, [patientId, dispatch]);

    if (isLoading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading clinical history...</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                <ClipboardList size={40} className="mb-4 opacity-50" />
                <p className="text-[10px] font-black uppercase tracking-widest">No sessions recorded yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {history.map((session, idx) => (
                <div key={session.id || idx} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-indigo-500" />
                            <span className="text-[10px] font-black text-slate-800 uppercase tabular-nums">
                                {(() => {
                                    const dStr = session.date || session.created_at;
                                    if (!dStr) return 'N/A';
                                    const d = new Date(dStr.includes(' ') ? dStr.replace(' ', 'T') : dStr);
                                    return isNaN(d.getTime()) ? dStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                })()}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {['subjective', 'objective', 'assessment', 'plan'].map(field => (
                            <div key={field} className="space-y-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{field}</span>
                                <p className="text-[11px] font-bold text-slate-700 line-clamp-2 leading-relaxed">
                                    {session.soap_notes?.[field] || '—'}
                                </p>
                            </div>
                        ))}
                    </div>

                    {session.treatment_plan && (
                        <div className="pt-3 border-t border-slate-200/60">
                            <span className="text-[8px] font-black text-cyan-600 uppercase tracking-wider block mb-1">treatment plan</span>
                            <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic line-clamp-3">
                                {session.treatment_plan}
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
