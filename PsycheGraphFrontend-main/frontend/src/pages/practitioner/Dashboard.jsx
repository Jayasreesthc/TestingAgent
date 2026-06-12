import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Users,
    Activity,
    PlayCircle,
    Clock,
    ChevronRight,
    Stethoscope,
    FileText,
    ArrowRight,
    TrendingUp,
    Sparkles,
    Shield,
    Bell,
    History,
    Search,
    UserCheck,
    Briefcase,
    Video
} from 'lucide-react';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchSessions } from '../../store/slices/SessionSlice';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function PractitionerDashboard() {
    const dispatch = useDispatch();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: patients, loading: patLoading } = useSelector((state) => state.patients);
    const { list: sessions } = useSelector((state) => state.sessions);
    const { user } = useSelector((state) => state.auth);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        dispatch(fetchSessions());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [dispatch]);

    const todayString = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments
        .filter(app => app.start_time?.startsWith(todayString))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const nextPatient = todaysAppointments.find(app => app.status === 'SCHEDULED' && new Date(app.start_time) > new Date());
    const ongoingSession = todaysAppointments.find(app => app.status === 'ONGOING');

    // Debugging user object
    useEffect(() => {
        console.log('PractitionerDashboard User Object:', user);
    }, [user]);

    // Dynamic Stats Logic
    const stats = useMemo(() => {
        // 1. Sessions This Week
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
        endOfWeek.setHours(23, 59, 59, 999);

        const sessionsThisWeek = sessions.filter(s => {
            const d = new Date(s.created_at);
            return d >= startOfWeek && d <= endOfWeek;
        });

        const appointmentsThisWeek = appointments.filter(a => {
            const d = new Date(a.start_time);
            return d >= startOfWeek && d <= endOfWeek && a.status !== 'CANCELLED';
        });

        const sessionsRemaining = Math.max(0, appointmentsThisWeek.length - sessionsThisWeek.length);

        // 2. Pending Notes
        // Appointments in the past that don't have a session record
        const pastAppointments = appointments.filter(a => {
            return new Date(a.start_time) < now && a.status !== 'CANCELLED';
        });

        const pendingNotes = pastAppointments.filter(app => {
            return !sessions.some(s => String(s.appointment_id) === String(app.id));
        });

        const pendingNotesDueToday = pendingNotes.filter(app => app.start_time.startsWith(todayString));

        // 3. Upcoming Trend
        const nextAppTime = nextPatient
            ? new Date(nextPatient.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--';

        return [
            {
                label: 'Active Patients',
                value: patients.length,
                icon: Users,
                color: 'from-indigo-600 to-blue-500',
                glow: 'shadow-blue-500/20',
                trend: `+${patients.filter(p => new Date(p.created_at || Date.now()).getMonth() === now.getMonth()).length} this month`,
                subLabel: 'Total active cases'
            },
            {
                label: 'Sessions This Week',
                value: sessionsThisWeek.length,
                icon: Video,
                color: 'from-violet-600 to-purple-500',
                glow: 'shadow-purple-500/20',
                trend: `${sessionsRemaining} remaining`,
                subLabel: 'Weekly load'
            },
            {
                label: 'Pending Notes',
                value: pendingNotes.length,
                icon: FileText,
                color: 'from-amber-500 to-orange-500',
                glow: 'shadow-orange-500/20',
                trend: `Due today: ${pendingNotesDueToday.length}`,
                subLabel: 'Action required'
            },
            {
                label: 'Upcoming Appointments',
                value: todaysAppointments.length,
                icon: Calendar,
                color: 'from-emerald-600 to-teal-500',
                glow: 'shadow-emerald-500/20',
                trend: `Next: ${nextAppTime}`,
                subLabel: 'View schedule'
            },
        ];
    }, [sessions, appointments, patients, todayString, nextPatient, todaysAppointments]);

    if (appLoading || patLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="text-primary-500"
                    >
                        <Activity size={60} strokeWidth={1} />
                    </motion.div>
                    <motion.div
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 flex items-center justify-center text-xs font-black text-primary-600 uppercase tracking-widest"
                    >
                        syncing
                    </motion.div>
                </div>
            </div>
        );
    }


    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };


    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-[1400px] mx-auto space-y-6 pb-20 px-4 pt-4"
        >
            {/* Ultra-Modern Header */}
            <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-2">
                    <h1
                        className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight"
                        data-debug-user={JSON.stringify(user || 'no-user')}
                    >
                        {getGreeting()}, <span className="text-slate-800 bg-clip-text text-transparent bg-slate-900 animate-gradient-x  decoration-primary-100 decoration-4 underline-offset-4">
                            Dr. {(
                                user?.full_name || 'Clinician'
                            ).toString().replace(/^(dr\.?\s*)/i, '')}
                        </span>
                    </h1>
                    <p className="text-slate-500 font-medium text-lg flex items-center gap-3">
                        <Shield size={20} className="text-primary-500" />
                        Your clinical dashboard is synced and secured.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end px-6 py-3 bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Local Time</span>
                        <span className="text-xl font-black text-slate-800 tabular-nums">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>

                </div>
            </motion.div>

            {/* Stats Visualization */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            whileHover={{ y: -8, scale: 1.01 }}
                            className="relative group cursor-default"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative bg-white p-5 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                                <div className={cn("absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br opacity-5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700", stat.color)} />

                                <div className="flex items-start justify-between mb-4">
                                    <div className={cn("p-3 rounded-xl shadow-xl text-white bg-gradient-to-br", stat.color, stat.glow)}>
                                        <Icon size={22} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                                            <TrendingUp size={10} />
                                            {stat.trend}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
                                        <span className="text-[10px] font-bold text-slate-400">{stat.subLabel}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Core Action Grid */}
            <div className="flex flex-col gap-8">

                {/* Recent Appointments */}
                <motion.div variants={itemVariants} className="flex flex-col space-y-6">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-sm sticky top-0 z-20">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Appointments</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Top 5 Recently Added</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Patient</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Date</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Time</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Type</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(() => {
                                        const recentApps = [...appointments]
                                            .sort((a, b) => new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time))
                                            .slice(0, 5);

                                        return recentApps.length > 0 ? recentApps.map((app) => (
                                            <motion.tr
                                                key={app.id}
                                                whileHover={{ backgroundColor: 'rgba(241, 245, 249, 0.5)' }}
                                                className="group cursor-pointer transition-colors"
                                            >
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-black text-sm">
                                                            {app.patient_name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <span className="font-bold text-slate-700 group-hover:text-primary-600 transition-colors capitalize">{app.patient_name || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-sm font-bold text-slate-500">{new Date(app.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Clock size={14} className="text-slate-400" />
                                                        <span className="text-sm font-bold">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-sm font-bold text-slate-500 capitalize">{app.booking_type || 'Offline'}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                        app.status === 'SCHEDULED' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                            app.status === 'COMPLETED' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                                                app.status === 'CANCELLED' ? "bg-red-50 text-red-600 border border-red-100" :
                                                                    app.status === 'RESCHEDULED' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                                                        "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {app.status || 'Scheduled'}
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="py-20 text-center">
                                                    <div className="flex flex-col items-center opacity-30">
                                                        <Calendar size={48} className="mb-4" strokeWidth={1} />
                                                        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">No Appointments Found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>

                {/* Right Side: Quick Action Panel */}
                {/* <motion.div variants={itemVariants} className="xl:col-span-4 flex flex-col space-y-6">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Quick Actions</h3>

                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Patient Records', icon: Users, color: 'text-indigo-600 bg-indigo-50', path: '/practitioner/patients' },
                                { label: 'Schedule Sync', icon: Calendar, color: 'text-emerald-600 bg-emerald-50', path: '/practitioner/schedule' },
                                { label: 'Go to Session', icon: PlayCircle, color: 'text-primary-600 bg-primary-50', path: '/sessions' },
                                { label: 'Create SOAP Note', icon: FileText, color: 'text-purple-600 bg-purple-50', path: '/practitioner/soap-notes' },
                            ].map((action) => (
                                <motion.button
                                    key={action.label}
                                    whileHover={{ y: -4, backgroundColor: '#f8fafc' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => window.location.href = action.path}
                                    className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl border border-slate-50 transition-all bg-white group"
                                >
                                    <div className={cn("p-4 rounded-xl transition-all group-hover:scale-110 group-hover:rotate-3", action.color)}>
                                        <action.icon size={24} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-slate-800 tracking-tight text-xs leading-tight">{action.label}</p>
                                    </div>
                                </motion.button>
                            ))}
                        </div>

                        

                    </div>
                </motion.div> */}
            </div>
        </motion.div>
    );
}

// Minimal helper check
const CheckCircle2 = ({ size, className, strokeWidth = 2 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
