import { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    User,
    Plus,
    Loader2,
    Search,
    Phone,
    Mail,
    MapPin,
    Activity,
    Eye,
    X
} from 'lucide-react';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import api from '../../services/api';
import AppointmentModal from '../../components/AppointmentModal';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function ReceptionistCalendar() {
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: rawAppointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { list: users } = useSelector((state) => state.users);

    const [view, setView] = useState('Daily'); // 'Daily', 'Weekly', 'Monthly'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [doctorFilter, setDoctorFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedPatientProfile, setSelectedPatientProfile] = useState(null);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const hasAutoNavigated = useRef(false);

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        dispatch(fetchUsers());
    }, [dispatch]);

    // Auto-navigate to the date of the first upcoming appointment if none visible in current week
    useEffect(() => {
        if (hasAutoNavigated.current) return;
        if (rawAppointments.length === 0) return;

        const today = new Date();
        const startOfCurrentWeek = new Date(today);
        startOfCurrentWeek.setDate(today.getDate() - today.getDay());
        startOfCurrentWeek.setHours(0, 0, 0, 0);
        const endOfCurrentWeek = new Date(startOfCurrentWeek);
        endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 7);
        endOfCurrentWeek.setHours(23, 59, 59, 999);

        const hasAppointmentsThisWeek = rawAppointments.some(app => {
            const d = new Date(app.start_time);
            return d >= startOfCurrentWeek && d <= endOfCurrentWeek;
        });

        if (!hasAppointmentsThisWeek) {
            // Find the nearest upcoming appointment date
            const upcomingDates = rawAppointments
                .map(app => new Date(app.start_time))
                .filter(d => d >= today)
                .sort((a, b) => a - b);

            if (upcomingDates.length > 0) {
                setCurrentDate(upcomingDates[0]);
            }
        }

        hasAutoNavigated.current = true;
    }, [rawAppointments]);

    const doctors = useMemo(() => {
        // Broad search for assigned doctors in the current user profile (handles nesting and various formats)
        const profileAssignedDoctors =
            currentUser?.assigned_doctors ||
            currentUser?.user?.assigned_doctors ||
            currentUser?.details?.assigned_doctors ||
            currentUser?.doctor?.assigned_doctors;

        const orgId = currentUser?.organization_id || currentUser?.user?.organization_id;
        const allOrgDoctors = users.filter(u =>
            (u.role === 'DOCTOR' || u.is_doctor) &&
            String(u.organization_id) === String(orgId)
        );

        let mappedAssigned = [];
        if (Array.isArray(profileAssignedDoctors) && profileAssignedDoctors.length > 0) {
            mappedAssigned = profileAssignedDoctors.map((d) => {
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
                    role: 'DOCTOR'
                };
            });
        }

        // If assigned doctors is empty or less than what's available in the org list,
        // use the organization list as the source of truth for the dropdown.
        if (mappedAssigned.length === 0 || (allOrgDoctors.length > mappedAssigned.length)) {
            return allOrgDoctors.map(u => ({
                id: String(u.id || u.user_id),
                full_name: u.full_name || u.name || "Unknown Practitioner",
                role: 'DOCTOR'
            }));
        }

        return mappedAssigned;
    }, [users, currentUser]);

    const mappedAppointments = useMemo(() => {
        const orgId = currentUser?.organization_id || currentUser?.user?.organization_id;
        const doctorIds = new Set(doctors.map(d => String(d.id)));

        // Filter by doctor list if we have one, otherwise fall back to org_id on the appointment
        let filtered = rawAppointments.filter(app => {
            if (doctorIds.size > 0) {
                return doctorIds.has(String(app.doctor_id));
            }
            // Fallback: use organization_id on the appointment itself
            return orgId ? String(app.organization_id) === String(orgId) : true;
        });

        // Doctor Filtering
        if (doctorFilter !== 'All') {
            filtered = filtered.filter(app => String(app.doctor_id) === String(doctorFilter));
        }

        // Search Filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(app => {
                const pName = app.patient_name || '';
                const dName = app.doctor_name || '';
                return pName.toLowerCase().includes(term) || dName.toLowerCase().includes(term);
            });
        }

        return filtered.map(app => {
            const patient = patients.find(p => String(p.id) === String(app.patient_id));
            const doctor = doctors.find(d => String(d.id) === String(app.doctor_id));

            return {
                ...app,
                patient_name: app.patient_name || patient?.full_name || 'Patient',
                doctor_name: app.doctor_name || doctor?.full_name || (app.doctor_id ? `Practitioner #${app.doctor_id}` : 'Assigned Practitioner')
            };
        });
    }, [rawAppointments, patients, doctors, doctorFilter, searchTerm, currentUser]);

    // --- Date Helpers ---

    const startOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
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

        const startPadding = firstDay.getDay();
        const days = [];

        // Prev month padding
        for (let i = startPadding - 1; i >= 0; i--) {
            days.push(new Date(year, month, -i));
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        // Next month padding to fill 6 weeks (42 days)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push(new Date(year, month + 1, i));
        }

        return days;
    };

    const weekDays = useMemo(() => getDaysInWeek(currentDate), [currentDate]);
    const monthDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00

    const formatRange = () => {
        if (view === 'Daily') {
            return currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        if (view === 'Monthly') {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        const start = weekDays[0];
        const end = weekDays[6];
        const startMonth = start.toLocaleString('default', { month: 'short' });
        const endMonth = end.toLocaleString('default', { month: 'short' });
        const year = end.getFullYear();

        if (startMonth === endMonth) {
            return `${startMonth} ${start.getDate()} — ${end.getDate()}, ${year}`;
        }
        return `${startMonth} ${start.getDate()} — ${endMonth} ${end.getDate()}, ${year}`;
    };

    const navigateDate = (direction) => {
        const newDate = new Date(currentDate);
        if (view === 'Weekly') {
            newDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (view === 'Daily') {
            newDate.setDate(currentDate.getDate() + direction);
        } else if (view === 'Monthly') {
            newDate.setMonth(currentDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    const resetToToday = () => {
        setCurrentDate(new Date());
    };

    const handleAppointmentClick = (app) => {
        const patient = patients.find(p => String(p.id) === String(app.patient_id));
        if (patient) {
            setSelectedPatientProfile(patient);
            setIsProfileModalOpen(true);
        }
    };

    // --- Renderers ---

    const renderDailyView = () => {
        const todayStr = getLocalDateStr(currentDate);
        const dayAppointments = mappedAppointments.filter(app => {
            return getLocalDateStr(app.start_time) === todayStr;
        });

        return (
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="min-w-full">
                    {hours.map((hour) => {
                        const timeString = `${hour.toString().padStart(2, '0')}:00`;
                        const hourAppointments = dayAppointments.filter(app => {
                            const d = new Date(app.start_time);
                            return d.getHours() === hour;
                        });

                        return (
                            <div key={hour} className="group flex border-b border-slate-100 min-h-[80px] relative">
                                <div className="w-20 py-4 px-4 text-xs font-mono text-slate-400 border-r border-slate-50 shrink-0 pt-3">
                                    {timeString}
                                </div>
                                <div className="flex-1 p-2 flex flex-wrap gap-2">
                                    {hourAppointments.map(app => {
                                        const isVideo = !!app.meet_link;
                                        const statusColor = app.status === 'SCHEDULED' ? 'bg-emerald-100 text-emerald-700'
                                            : app.status === 'RESCHEDULED' ? 'bg-amber-100 text-amber-700'
                                                : app.status === 'CANCELLED' ? 'bg-red-100 text-red-600'
                                                    : 'bg-slate-100 text-slate-500';
                                        return (
                                            <motion.div
                                                key={app.id}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    "h-fit min-w-[200px] max-w-[280px] p-3 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-all border-l-4",
                                                    isVideo
                                                        ? "bg-indigo-50 border-l-indigo-500"
                                                        : "bg-emerald-50 border-l-emerald-500"
                                                )}
                                                onClick={() => handleAppointmentClick(app)}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <p className={cn("text-[10px] font-black uppercase", isVideo ? "text-indigo-600" : "text-emerald-700")}>
                                                        {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {' – '}
                                                        {new Date(app.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide", statusColor)}>
                                                        {app.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-900 truncate">{app.patient_name}</p>
                                                <p className="text-[11px] text-slate-500 font-medium truncate">Pr. {app.doctor_name}</p>
                                                {isVideo && (
                                                    <p className="text-[9px] text-indigo-400 font-semibold mt-1">📹 Video Consult</p>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                    {hourAppointments.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <div className="w-[calc(100%-1rem)] h-px bg-slate-100 absolute top-1/2 left-4" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeeklyView = () => {
        return (
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 overflow-hidden">
                {weekDays.map((day, i) => {
                    const dayStr = getLocalDateStr(day);
                    const dayAppointments = mappedAppointments.filter(app => {
                        return getLocalDateStr(app.start_time) === dayStr;
                    });
                    const isToday = day.toDateString() === new Date().toDateString();

                    return (
                        <div key={i} className={cn(
                            "flex flex-col min-h-0",
                            isToday && "bg-indigo-500/[0.02]"
                        )}>
                            {/* Subheader for week view */}
                            <div className={cn("p-3 border-b text-center", isToday ? "border-indigo-100 bg-indigo-50/40" : "border-slate-50")}>
                                <p className={cn("text-[10px] font-bold uppercase tracking-widest", isToday ? "text-indigo-500" : "text-slate-400")}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                <p className={cn("text-lg font-black", isToday ? "text-indigo-600" : "text-slate-900")}>
                                    {day.getDate()}
                                </p>
                                {dayAppointments.length > 0 && (
                                    <span className="text-[8px] font-black text-slate-400">{dayAppointments.length} appt{dayAppointments.length > 1 ? 's' : ''}</span>
                                )}
                            </div>
                            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                                {dayAppointments.map(app => {
                                    const isVideo = !!app.meet_link;
                                    const statusColor = app.status === 'SCHEDULED' ? 'border-l-emerald-500 bg-emerald-50'
                                        : app.status === 'RESCHEDULED' ? 'border-l-amber-400 bg-amber-50'
                                            : app.status === 'CANCELLED' ? 'border-l-red-400 bg-red-50'
                                                : 'border-l-slate-400 bg-slate-50';
                                    return (
                                        <div
                                            key={app.id}
                                            className={cn("p-2 border border-slate-100 border-l-2 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer", statusColor)}
                                            onClick={() => handleAppointmentClick(app)}
                                        >
                                            <p className={cn("text-[9px] font-black", isVideo ? "text-indigo-500" : "text-emerald-600")}>
                                                {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{app.patient_name}</p>
                                            <p className="text-[9px] text-slate-400 font-medium truncate">Pr. {app.doctor_name}</p>
                                            {isVideo && <p className="text-[8px] text-indigo-400 font-semibold mt-0.5">📹 Video</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMonthlyView = () => {
        return (
            <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* Day Names Header */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>
                {/* Month Grid */}
                <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100">
                    {monthDays.map((day, i) => {
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const dayStr = getLocalDateStr(day);
                        const dayAppointments = mappedAppointments.filter(app => {
                            return getLocalDateStr(app.start_time) === dayStr;
                        });

                        return (
                            <div key={i} className={cn(
                                "p-1 flex flex-col min-h-0 relative group",
                                !isCurrentMonth && "bg-slate-50/50",
                                day.toDateString() === new Date().toDateString() && "bg-indigo-500/[0.02]"
                            )}>
                                <span className={cn(
                                    "text-xs font-bold p-1 w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                    !isCurrentMonth ? "text-slate-300" : "text-slate-700",
                                    day.toDateString() === new Date().toDateString() && "bg-indigo-500 text-white"
                                )}>
                                    {day.getDate()}
                                </span>
                                <div className="flex-1 space-y-1 overflow-hidden">
                                    {dayAppointments.slice(0, 3).map(app => {
                                        const isVideo = !!app.meet_link;
                                        return (
                                            <div
                                                key={app.id}
                                                className={cn(
                                                    "px-2 py-1.5 text-[10px] font-bold rounded-lg border cursor-pointer hover:opacity-80 transition-opacity shadow-sm",
                                                    isVideo
                                                        ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                                        : "bg-emerald-50 text-emerald-800 border-emerald-100"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAppointmentClick(app);
                                                }}
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] opacity-80">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        {isVideo && <span className="text-[8px] animate-pulse text-indigo-500">●</span>}
                                                    </div>
                                                    <div className="truncate leading-tight font-black">{app.patient_name}</div>
                                                    <div className="truncate text-[9px] opacity-70 font-bold italic">Pr. {app.doctor_name}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {dayAppointments.length > 3 && (
                                        <p className="text-[8px] font-black text-slate-400 pl-1">+{dayAppointments.length - 3} more</p>
                                    )}
                                </div>
                                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-[#21a18c] transition-opacity">
                                    <Plus size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Calendar</h1>
                    <p className="text-slate-500 mt-1 font-medium">View and manage appointment schedules.</p>
                </div>

                {/* View Switcher & Action */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                        onClick={() => setIsAppointmentModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1b8a77] transition-all shadow-lg shadow-[#21a18c]/20"
                    >
                        <CalendarIcon size={16} />
                        <span>New Appointment</span>
                    </button>

                    <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
                        {['Daily', 'Weekly', 'Monthly'].map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={cn(
                                    "px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300 uppercase tracking-widest",
                                    view === v
                                        ? "bg-indigo-500 text-white shadow-lg shadow-[#21a18c]/20 "
                                        : "text-slate-500 hover:text-slate-800 hover:bg-white"
                                )}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Navigation & Range */}
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <select
                        value={doctorFilter}
                        onChange={(e) => setDoctorFilter(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 outline-none focus:ring-4 focus:ring-[#21a18c]/10 transition-all min-w-[150px] shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="All">All Practitioners</option>
                        {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>Pr. {doc.full_name}</option>
                        ))}
                    </select>

                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                        <button
                            onClick={() => navigateDate(-1)}
                            className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-[#21a18c] transition-all transform hover:scale-105"
                        >
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => navigateDate(1)}
                            className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-[#21a18c] transition-all transform hover:scale-105"
                        >
                            <ChevronRight size={20} strokeWidth={3} />
                        </button>
                    </div>
                    <button
                        onClick={resetToToday}
                        className="px-6 py-2.5 text-[10px] font-black text-slate-500 hover:bg-indigo-500 hover:text-white border border-slate-100 hover:border-indigo-500 rounded-2xl transition-all uppercase tracking-widest bg-white shadow-sm"
                    >
                        Today
                    </button>
                </div>

                <h2 className="text-2xl font-black text-slate-900 tracking-tight drop-shadow-sm">
                    {formatRange()}
                </h2>

                <div className="flex items-center gap-4">
                    <div className="relative group hidden sm:block">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#21a18c] transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Find appointment..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-[#21a18c]/10 focus:border-[#21a18c] transition-all w-72 placeholder:text-slate-300"
                        />
                    </div>
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view + currentDate.toISOString()}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col min-h-0"
                    >
                        {view === 'Daily' && renderDailyView()}
                        {view === 'Weekly' && renderWeeklyView()}
                        {view === 'Monthly' && renderMonthlyView()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Status Bar */}
            {/* <div className="flex items-center justify-between px-6 py-4 bg-slate-900 rounded-3xl text-white shadow-lg">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-[#21a18c]/20" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Sessions</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Video Calls</span>
                    </div>
                </div>
                {loading ? (
                    <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                        <Loader2 className="animate-spin text-[#21a18c]" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Updating Sync...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Server Connected</span>
                    </div>
                )}
            </div> */}

            {/* Patient Profile Modal */}
            <AnimatePresence>
                {isProfileModalOpen && selectedPatientProfile && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2rem] shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-8 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 bg-indigo-500 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-500/20">
                                        {selectedPatientProfile.full_name?.[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Patient Profile</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Verified Medical Record</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsProfileModalOpen(false); setSelectedPatientProfile(null); }}
                                    className="p-3 hover:bg-rose-50 rounded-2xl transition-all text-slate-400 hover:text-rose-500 group"
                                >
                                    <X size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="px-8 py-8 overflow-y-auto custom-scrollbar space-y-8">
                                <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Full Name</p>
                                        <p className="text-lg font-black text-slate-700">{selectedPatientProfile.full_name}</p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Gender</p>
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-indigo-500" />
                                            <p className="text-lg font-black text-slate-700 capitalize">{selectedPatientProfile.gender || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Contact Number</p>
                                        <div className="flex items-center gap-2">
                                            <Phone size={16} className="text-indigo-500" />
                                            <p className="text-lg font-black text-slate-700">{selectedPatientProfile.contact_number}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Email Address</p>
                                        <div className="flex items-center gap-2">
                                            <Mail size={16} className="text-indigo-500" />
                                            <p className="text-lg font-black text-slate-700 truncate max-w-[200px]">{selectedPatientProfile.email}</p>
                                        </div>
                                    </div>

                                    <div className="col-span-2 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Residential Address</p>
                                        <div className="flex gap-3">
                                            <MapPin size={18} className="text-indigo-500 shrink-0 mt-1" />
                                            <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                                                {selectedPatientProfile.address || 'No address provided in records'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Appointment History */}
                                <div className="space-y-5 pt-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xl font-black text-slate-800 tracking-tight">Recent Sessions</h4>
                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">History</span>
                                    </div>
                                    <div className="space-y-3">
                                        {rawAppointments
                                            .filter(a => String(a.patient_id) === String(selectedPatientProfile.id))
                                            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
                                            .slice(0, 5)
                                            .map((appt) => {
                                                const apptDate = new Date(appt.start_time);
                                                return (
                                                    <div key={appt.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                                                                <Clock size={16} className="text-slate-400 group-hover:text-indigo-500" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-slate-700">
                                                                    {apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                                    {apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className={cn(
                                                            "px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest border",
                                                            appt.status === 'SCHEDULED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                                appt.status === 'RESCHEDULED' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                                    appt.status === 'CANCELLED' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                                                        "bg-slate-50 text-slate-600 border-slate-100"
                                                        )}>
                                                            {appt.status}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        {rawAppointments.filter(a => String(a.patient_id) === String(selectedPatientProfile.id)).length === 0 && (
                                            <div className="py-10 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                <p className="text-sm text-slate-400 font-bold italic">No session history found for this patient.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-8 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={() => { setIsProfileModalOpen(false); setSelectedPatientProfile(null); }}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                                >
                                    Close Record Overview
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Appointment Modal */}
            <AppointmentModal
                isOpen={isAppointmentModalOpen}
                onClose={() => setIsAppointmentModalOpen(false)}
            />
        </div>
    );
};