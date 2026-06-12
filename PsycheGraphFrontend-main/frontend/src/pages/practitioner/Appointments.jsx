import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAppointments, createAppointment, deleteAppointment, rescheduleAppointment } from '../../store/slices/AppointmentSlice';
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
    MapPin
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function PractitionerAppointments() {
    const dispatch = useDispatch();
    const { list: rawAppointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const user = useSelector((state) => state.auth?.user || state.login?.user);

    const [tabMode, setTabMode] = useState('Calendar View'); // 'Calendar View' or 'List View'
    const [view, setView] = useState('Weekly'); // 'Daily', 'Weekly', 'Monthly'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        patient_id: '',
        date: '',
        time: '',
        notes: ''
    });

    const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Resolve practitioner ID
    const practitionerId = user?.id || user?.user?.id || user?.practitioner_id || '';

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
    }, [dispatch]);

    // Map appointments to resolve patient names and filter for current practitioner
    const mappedAppointments = useMemo(() => {
        let filtered = rawAppointments;

        // Strictly filter by current practitioner's ID
        if (practitionerId) {
            filtered = filtered.filter(app => String(app.practitioner_id) === String(practitionerId));
        }

        // Search filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(app => {
                const pName = (app.patient_name || patients.find(p => String(p.id) === String(app.patient_id))?.full_name || '').toLowerCase();
                return pName.includes(term);
            });
        }

        return filtered.map(app => {
            const patient = patients.find(p => String(p.id) === String(app.patient_id));
            return {
                ...app,
                patient_name: app.patient_name || patient?.full_name || 'Patient'
            };
        });
    }, [rawAppointments, patients, searchTerm, practitionerId]);

    // --- Date Helpers ---
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

    const handleCreate = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${formData.date}T${formData.time}`);
            const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // Default 30 min
            const selectedPatient = patients.find(p => String(p.id) === String(formData.patient_id));

            await dispatch(createAppointment({
                patient_id: parseInt(formData.patient_id),
                practitioner_id: practitionerId,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                notes: formData.notes,
                // patient_age: parseInt(selectedPatient?.age || 0, 10),
                booking_type: 'offline' // Default
            })).unwrap();
            setIsModalOpen(false);
            setFormData({ patient_id: '', date: '', time: '', notes: '' });
            dispatch(fetchAppointments());
        } catch (e) {
            console.error(e);
            alert("Failed to book appointment");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Renderers ---
    const renderDailyView = () => {
        const todayStr = getLocalDateStr(currentDate);
        const dayAppointments = mappedAppointments.filter(app => getLocalDateStr(app.start_time) === todayStr);

        return (
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                <div className="min-w-full">
                    {hours.map((hour) => {
                        const timeString = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                        const hourAppointments = dayAppointments.filter(app => {
                            const d = new Date(app.start_time);
                            return d.getHours() === hour;
                        });

                        return (
                            <div key={hour} className="group flex border-b border-slate-50 min-h-[100px] relative">
                                <div className="w-24 py-4 px-4 text-[10px] font-black text-slate-400 border-r border-slate-50 shrink-0 uppercase tracking-tighter">
                                    {timeString}
                                </div>
                                <div className="flex-1 p-2 flex flex-wrap gap-3">
                                    {hourAppointments.map(app => (
                                        <div
                                            key={app.id}
                                            onClick={() => {
                                                const patient = patients.find(p => String(p.id) === String(app.patient_id));
                                                setSelectedPatient(patient || { full_name: app.patient_name });
                                                setIsPatientModalOpen(true);
                                            }}
                                            className={cn(
                                                "h-fit min-w-[240px] max-w-[320px] p-4 rounded-2xl shadow-sm border-l-4 transition-all hover:shadow-md cursor-pointer active:scale-[0.98]",
                                                app.booking_type === 'online' ? "bg-indigo-50 border-l-indigo-500" : "bg-emerald-50 border-l-emerald-500"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">
                                                    {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={cn(
                                                    "text-[8px] font-black px-2 py-0.5 rounded-full uppercase",
                                                    app.status === 'SCHEDULED' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                                )}>
                                                    {app.status}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">{app.patient_name}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {app.booking_type === 'online' && <Video size={14} className="text-indigo-500" />}
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{app.booking_type || 'offline'} Visit</span>
                                            </div>
                                        </div>
                                    ))}
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
                const dayAppointments = mappedAppointments.filter(app => getLocalDateStr(app.start_time) === dayStr);
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                    <div key={i} className={cn("flex flex-col min-h-0", isToday && "bg-indigo-50/30")}>
                        <div className={cn("p-4 border-b text-center", isToday ? "bg-indigo-50/50" : "bg-slate-50/30")}>
                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isToday ? "text-indigo-500" : "text-slate-400")}>
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className={cn("text-xl font-black", isToday ? "text-indigo-600 font-black" : "text-slate-900")}>{day.getDate()}</p>
                        </div>
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                            {dayAppointments.map(app => (
                                <div 
                                    key={app.id} 
                                    onClick={() => {
                                        const patient = patients.find(p => String(p.id) === String(app.patient_id));
                                        setSelectedPatient(patient || { full_name: app.patient_name });
                                        setIsPatientModalOpen(true);
                                    }}
                                    className={cn(
                                        "p-2.5 rounded-xl border border-slate-100 border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]",
                                        app.booking_type === 'online' ? "border-l-indigo-500 bg-indigo-50/50" : "border-l-emerald-500 bg-emerald-50/50"
                                    )}
                                >
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                                        {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2">{app.patient_name}</p>
                                    {app.booking_type === 'online' && <div className="mt-1 flex items-center gap-1 text-indigo-500 font-bold text-[8px] uppercase"><Video size={10} /> Video</div>}
                                </div>
                            ))}
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
                    const dayAppts = mappedAppointments.filter(app => getLocalDateStr(app.start_time) === dayStr);
                    const isToday = day.toDateString() === new Date().toDateString();

                    return (
                        <div key={i} className={cn("p-1.5 flex flex-col min-h-0 relative", !isCurrentMonth && "bg-slate-50/50", isToday && "bg-indigo-50/30")}>
                            <span className={cn(
                                "text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl mb-1",
                                !isCurrentMonth ? "text-slate-300" : isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-700"
                            )}>
                                {day.getDate()}
                            </span>
                            <div className="flex-1 space-y-1 overflow-hidden">
                                {dayAppts.slice(0, 3).map(app => (
                                    <div 
                                        key={app.id} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const patient = patients.find(p => String(p.id) === String(app.patient_id));
                                            setSelectedPatient(patient || { full_name: app.patient_name });
                                            setIsPatientModalOpen(true);
                                        }}
                                        className={cn(
                                            "px-2 py-0.5 text-[8px] font-bold rounded-lg truncate border cursor-pointer hover:brightness-95 active:scale-95 transition-all text-left",
                                            app.booking_type === 'online' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                        )}
                                    >
                                        {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} {app.patient_name}
                                    </div>
                                ))}
                                {dayAppts.length > 3 && <p className="text-[8px] font-black text-slate-400 pl-1">+{dayAppts.length - 3} more</p>}
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

                    {/* <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Plus size={16} strokeWidth={3} /> Schedule New
                    </button> */}
                </div>
            </div>

            {tabMode === 'Calendar View' ? (
                <div className="space-y-6">
                    {/* Calendar Control Bar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                {['Daily', 'Weekly', 'Monthly'].map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => setView(v)}
                                        className={cn(
                                            "px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                                            view === v ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-700"
                                        )}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-4">
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
                                    className="pl-11 pr-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 w-48 transition-all"
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
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visit Type</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mappedAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(app => (
                                    <tr 
                                        key={app.id} 
                                        onClick={() => {
                                            const patient = patients.find(p => String(p.id) === String(app.patient_id));
                                            setSelectedPatient(patient || { full_name: app.patient_name });
                                            setIsPatientModalOpen(true);
                                        }}
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

            {/* Schedule Modal (Simplified) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 border border-white/20">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900">Schedule New</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Patient</label>
                                <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none" value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })}>
                                    <option value="">Search patient...</option>
                                    {patients.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                                    <input required type="date" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</label>
                                    <input required type="time" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes (Optional)</label>
                                <textarea className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[100px] resize-none" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all text-sm">
                                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={24} /> : "Confirm Schedule"}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}

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
                                        onClick={() => setIsPatientModalOpen(false)}
                                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

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

                                <button
                                    onClick={() => setIsPatientModalOpen(false)}
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
