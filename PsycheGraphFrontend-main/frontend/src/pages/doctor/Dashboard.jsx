import { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { createSoapNote, fetchSessions, updateSession, uploadAudio, fetchPatientHistory } from '../../store/slices/SessionSlice';
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
    Video,
    MapPin,
    AlertCircle,
    X,
    User,
    Mic,
    Loader2,
    Send,
    CheckCircle2,
    FileSearch,
    ExternalLink,
    Edit3
} from 'lucide-react';
import AppointmentModal from '../../components/AppointmentModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function DoctorDashboard() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: patients, loading: patLoading } = useSelector((state) => state.patients);
    const { list: sessions, patientHistory, loading: sessionLoading } = useSelector((state) => state.sessions);
    const { user } = useSelector((state) => state.auth);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        dispatch(fetchSessions());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [dispatch]);

    const currentDoctor = useMemo(() => {
        if (!user) return null;
        return {
            id: user.id || user.user_id,
            full_name: user.full_name || user.name || "Practitioner",
            role: 'DOCTOR'
        };
    }, [user?.id, user?.user_id, user?.full_name, user?.name]);

    const todayString = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments
        .filter(app => app.start_time?.startsWith(todayString))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const ongoingSession = todaysAppointments.find(app => app.status === 'ONGOING');

    // Find the absolute next appointment in the future
    const nextAppointment = useMemo(() => {
        const now = new Date();
        return [...appointments]
            .filter(app => app.status === 'SCHEDULED' && new Date(app.start_time) > now)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
    }, [appointments]);

    const nextPatient = nextAppointment; // for compatibility with existing stats calculation

    const latestSessionForNextPatient = useMemo(() => {
        if (!nextAppointment) return null;
        return [...sessions]
            .filter(s => String(s.patient_id) === String(nextAppointment.patient_id))
            .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))[0];
    }, [nextAppointment, sessions]);

    // Notification Logic
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const checkUpcomingSessions = () => {
            const now = new Date();
            const upcoming = todaysAppointments.filter(app => {
                const startTime = new Date(app.start_time);
                const diffMins = (startTime - now) / 60000;
                return diffMins > 0 && diffMins <= 15 && app.status === 'SCHEDULED';
            });

            if (upcoming.length > 0) {
                const newNotifications = upcoming.map(app => ({
                    id: `notif-${app.id}`,
                    message: `Session with ${app.patient_name} starts in ${Math.round((new Date(app.start_time) - now) / 60000)} minutes.`,
                    type: 'warning'
                }));
                // Only set if different to avoid infinite loop
                setNotifications(prev => {
                    const existingIds = prev.map(n => n.id);
                    const filteredNew = newNotifications.filter(n => !existingIds.includes(n.id));
                    return [...prev, ...filteredNew];
                });
            }
        };

        const interval = setInterval(checkUpcomingSessions, 60000); // Check every minute
        checkUpcomingSessions();
        return () => clearInterval(interval);
    }, [todaysAppointments]);

    // SOAP Modal State
    const [soapModal, setSoapModal] = useState({
        isOpen: false,
        appointment: null,
        notes: { subjective: '', objective: '', assessment: '', plan: '' },
        treatment_plan: '',
        sessionId: null,
        activeTab: 'notes'
    });
    const [isSavingSoap, setIsSavingSoap] = useState(false);
    const [soapSuccess, setSoapSuccess] = useState(false);
    const [soapError, setSoapError] = useState('');

    const [latestSessionModal, setLatestSessionModal] = useState({
        isOpen: false,
        patient_id: null,
        patient_name: ''
    });

    // Reschedule Modal State
    const [rescheduleModal, setRescheduleModal] = useState({
        isOpen: false,
        appointment: null
    });

    const handleOpenRescheduleModal = (app) => {
        setRescheduleModal({
            isOpen: true,
            appointment: app
        });
    };

    useEffect(() => {
        if (latestSessionModal.isOpen && latestSessionModal.patient_id) {
            dispatch(fetchPatientHistory(latestSessionModal.patient_id));
        }
    }, [latestSessionModal.isOpen, latestSessionModal.patient_id, dispatch]);

    const openLatestSessionModal = (app) => {
        setLatestSessionModal({
            isOpen: true,
            patient_id: app.patient_id,
            patient_name: app.patient_name
        });
    };

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isInitializingMic, setIsInitializingMic] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const doctorId = user?.id || user?.user?.id || user?.doctor_id || '';

    const prepareMic = async () => {
        if (streamRef.current) return;
        setIsInitializingMic(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
        } catch (err) {
            console.error("Microphone access denied:", err);
            setSoapError("Microphone access denied. Please enable permissions.");
        } finally {
            setIsInitializingMic(false);
        }
    };

    useEffect(() => {
        if (soapModal.activeTab === 'history' && soapModal.appointment?.patient_id) {
            dispatch(fetchPatientHistory(soapModal.appointment.patient_id));
        }
    }, [soapModal.activeTab, soapModal.appointment?.patient_id, dispatch]);

    const openSoapModal = async (app) => {
        const existingSession = sessions.find(s => String(s.appointment_id) === String(app.id));
        const existingNotes = existingSession?.soap_notes || { subjective: '', objective: '', assessment: '', plan: '' };

        setSoapModal({
            isOpen: true,
            appointment: app,
            notes: { ...existingNotes },
            treatment_plan: existingSession?.treatment_plan || '',
            sessionId: existingSession?.id || null,
            activeTab: 'notes'
        });
        setSoapError('');
        setSoapSuccess(false);

        // Pre-warm the mic stream
        await prepareMic();
    };

    const handleSoapSubmit = async (autoClose = true) => {
        if (!soapModal.appointment) return null;
        setIsSavingSoap(true);
        setSoapError('');
        try {
            let result;
            if (soapModal.sessionId) {
                result = await dispatch(updateSession({
                    id: soapModal.sessionId,
                    data: {
                        soap_notes: soapModal.notes,
                        treatment_plan: soapModal.treatment_plan,
                        patient_id: Number(soapModal.appointment.patient_id),
                        doctor_id: Number(doctorId),
                        appointment_id: Number(soapModal.appointment.id),
                    }
                })).unwrap();
            } else {
                result = await dispatch(createSoapNote({
                    patient_id: Number(soapModal.appointment.patient_id),
                    doctor_id: Number(doctorId),
                    appointment_id: Number(soapModal.appointment.id),
                    soap_notes: soapModal.notes,
                    treatment_plan: soapModal.treatment_plan
                })).unwrap();
            }

            if (autoClose) {
                setSoapSuccess(true);
                setTimeout(() => {
                    setSoapModal(prev => ({ ...prev, isOpen: false }));
                    setSoapSuccess(false);
                }, 2000);
            }

            // Return the session ID if available (newly created or updated)
            const sid = result?.id || soapModal.sessionId || result?.data?.id;
            if (sid && !soapModal.sessionId) {
                setSoapModal(prev => ({ ...prev, sessionId: sid }));
            }

            dispatch(fetchSessions());
            return sid;
        } catch (err) {
            setSoapError(err || 'Failed to save SOAP note');
            return null;
        } finally {
            setIsSavingSoap(false);
        }
    };

    const startRecording = async () => {
        try {
            let stream = streamRef.current;
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
            }

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (audioChunksRef.current.length === 0) return;
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                let sid = soapModal.sessionId;
                if (!sid) {
                    sid = await handleSoapSubmit(false);
                }

                if (sid) {
                    try {
                        await dispatch(uploadAudio({ session_id: sid, audioBlob })).unwrap();
                        setSoapSuccess(true);
                        setTimeout(() => setSoapSuccess(false), 3000);
                        dispatch(fetchSessions());
                    } catch (err) {
                        setSoapError(err || 'Failed to upload audio');
                    }
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Recording Error:', err);
            setSoapError('Could not access microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);

            // Note: We don't stop the stream here so it's ready for next time
            // We'll stop it when the modal closes
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Debugging user object
    useEffect(() => {
        console.log('DoctorDashboard User Object:', user);
    }, [user]);

    // Dynamic Stats Logic
    const stats = useMemo(() => {
        const d_id = user?.id || user?.user?.id || user?.doctor_id || '';
        const d_org_id = user?.organization_id || user?.user?.organization_id || '';

        // 1. Sessions This Week
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
        endOfWeek.setHours(23, 59, 59, 999);

        // Robust date parsing for sessions (checking multiple fields)
        const sessionsThisWeek = sessions.filter(s => {
            const dateStr = s.date || s.session_date || s.created_at;
            if (!dateStr) return false;

            const d = new Date(dateStr);
            const matchesDoctor = String(s.doctor_id) === String(d_id);
            return matchesDoctor && d >= startOfWeek && d <= endOfWeek;
        });

        const appointmentsThisWeek = appointments.filter(a => {
            if (!a.start_time) return false;
            const d = new Date(a.start_time);
            const matchesDoctor = String(a.doctor_id) === String(d_id);
            return matchesDoctor && d >= startOfWeek && d <= endOfWeek && a.status?.toUpperCase() !== 'CANCELLED';
        });

        const sessionsRemaining = Math.max(0, appointmentsThisWeek.length - sessionsThisWeek.length);

        // 2. Pending Notes
        // Appointments in the past for THIS doctor that don't have a session record
        const pastAppointments = appointments.filter(a => {
            if (!a.start_time) return false;
            const isMine = String(a.doctor_id) === String(d_id);
            return isMine && new Date(a.start_time) < now && a.status?.toUpperCase() !== 'CANCELLED';
        });

        const pendingNotes = pastAppointments.filter(app => {
            return !sessions.some(s => String(s.appointment_id) === String(app.id));
        });

        const pendingNotesDueToday = pendingNotes.filter(app => app.start_time?.startsWith(todayString));

        // 3. Upcoming Trend
        const nextAppTime = nextPatient
            ? new Date(nextPatient.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--';

        // Filter patients for this doctor/org if needed, currently using patients list which usually filters by org
        const myPatients = patients.filter(p => !d_id || String(p.doctor_id) === String(d_id) || String(p.organization_id) === String(d_org_id));

        return [
            {
                label: 'Active Patients',
                value: myPatients.length,
                icon: Users,
                color: 'from-indigo-600 to-blue-500',
                glow: 'shadow-blue-500/20',
                trend: `+${myPatients.filter(p => {
                    const d = new Date(p.created_at || Date.now());
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length} this month`,
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
            // {
            //     label: 'Upcoming Appointments',
            //     value: todaysAppointments.length,
            //     icon: Calendar,
            //     color: 'from-emerald-600 to-teal-500',
            //     glow: 'shadow-emerald-500/20',
            //     trend: `Next: ${nextAppTime}`,
            //     subLabel: 'View schedule'
            // },
        ];
    }, [sessions, appointments, patients, todayString, nextPatient, todaysAppointments, user]);

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
            {/* Notification Banner */}
            <AnimatePresence>
                {notifications.length > 0 && (
                    <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3">
                        {notifications.map((notif) => (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                className="bg-white border-l-4 border-amber-500 rounded-2xl shadow-2xl p-4 flex items-center gap-4 min-w-[300px]"
                            >
                                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                                    <Bell size={20} className="animate-bounce" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-slate-800 tracking-tight leading-tight">{notif.message}</p>
                                </div>
                                <button
                                    onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Ultra-Modern Header */}
            <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-2">
                    <h1
                        className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight"
                        data-debug-user={JSON.stringify(user || 'no-user')}
                    >
                        {getGreeting()}, <span className="text-slate-800 bg-clip-text text-transparent bg-slate-900 animate-gradient-x  decoration-primary-100 decoration-4 underline-offset-4">
                            Pr. {(
                                user?.full_name || 'Clinician'
                            ).toString().replace(/^(dr\.?\s*|pr\.?\s*)/i, '')}
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

            {/* Next Appointment Hero */}
            <motion.div variants={itemVariants}>
                {nextAppointment ? (
                    <div className="relative group overflow-hidden bg-gradient-to-br from-[#062f3f] to-[#0a4d68] rounded-[2.5rem] p-8 shadow-2xl border border-white/10">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-1000" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10" />

                        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
                            {/* Patient Portrait/Avatar */}
                            <div className="h-28 w-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl font-black text-white shadow-2xl ring-4 ring-white/5">
                                {nextAppointment.patient_name?.[0]?.toUpperCase() || 'P'}
                            </div>

                            <div className="flex-1 text-center lg:text-left">
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 mb-2">
                                    <span className="px-3 py-1 bg-cyan-400/20 text-cyan-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-cyan-400/30">
                                        UPCOMING CONSULTATION
                                    </span>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                                        <Calendar size={12} className="text-cyan-400" />
                                        {new Date(nextAppointment.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                </div>

                                <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-4">
                                    {nextAppointment.patient_name}
                                </h2>

                                <p className="text-cyan-100/60 font-bold flex items-center justify-center lg:justify-start gap-2">
                                    {(() => {
                                        const diff = new Date(nextAppointment.start_time) - currentTime;
                                        const mins = Math.floor(diff / 60000);
                                        const hours = Math.floor(mins / 60);
                                        const days = Math.floor(hours / 24);

                                        if (days > 0) return `Scheduled in ${days} day${days > 1 ? 's' : ''}`;
                                        if (hours > 0) return `Scheduled in ${hours} hour${hours > 1 ? 's' : ''}`;
                                        if (mins > 0) return `Consulation starts in ${mins} minute${mins > 1 ? 's' : ''}`;
                                        return "Consultation starts now";
                                    })()}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4">
                                <button
                                    onClick={() => navigate(`/doctor/patient-file/${nextAppointment.patient_id}`)}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase tracking-widest transition-all border border-white/10 text-[10px] flex items-center gap-2"
                                >
                                    <FileSearch size={14} />
                                    Review Notes
                                </button>

                                <button
                                    onClick={() => {
                                        window.location.href = `/doctor/session/${nextAppointment.id}/${nextAppointment.patient_id}`;
                                    }}
                                    className="px-8 py-4 bg-white text-[#062f3f] rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10 text-xs flex items-center gap-2"
                                >
                                    {nextAppointment.booking_type?.toLowerCase() === 'online' ? <Video size={16} /> : <PlayCircle size={16} />}
                                    {nextAppointment.booking_type?.toLowerCase() === 'online' ? 'Join Session' : 'Start Session'}
                                </button>

                                {latestSessionForNextPatient && (
                                    <button
                                        onClick={() => openLatestSessionModal(nextAppointment)}
                                        className="px-6 py-3 bg-cyan-400 text-[#062f3f] rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all text-[10px] flex items-center gap-2"
                                        title="Quick access to latest session"
                                    >
                                        <History size={14} />
                                        Latest Session
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 text-center shadow-lg shadow-slate-100/50">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Calendar size={32} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">You're all caught up!</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-tighter">No upcoming appointments scheduled for now.</p>
                    </div>
                )}
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

        {/* Agenda (Today's Schedule) */}
                <motion.div variants={itemVariants} className="flex flex-col space-y-6">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-sm sticky top-0 z-20">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Today's Agenda</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Full schedule for today</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <Calendar size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Time</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Patient</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Demographics</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Type</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {todaysAppointments.length > 0 ? todaysAppointments.map((app) => (
                                        <motion.tr
                                            key={app.id}
                                            whileHover={{ backgroundColor: 'rgba(241, 245, 249, 0.5)' }}
                                            className="group cursor-default transition-colors"
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2 text-slate-900">
                                                    <Clock size={16} className="text-primary-500" />
                                                    <span className="text-sm font-black tabular-nums">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-black text-sm">
                                                        {app.patient_name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <span className="font-bold text-slate-700 capitalize">{app.patient_name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-500">
                                                        {(() => {
                                                            const p = patients.find(pat => String(pat.id) === String(app.patient_id));
                                                            return `${p?.age || '--'} Yrs • ${p?.gender || '--'}`;
                                                        })()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    {app.booking_type === 'online' ? <Video size={14} className="text-indigo-500" /> : <MapPin size={14} className="text-emerald-500" />}
                                                    <span className="text-sm font-bold text-slate-500 capitalize">{app.booking_type || 'Offline'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            window.location.href = `/doctor/session/${app.id}/${app.patient_id}`;
                                                        }}
                                                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100 group/btn"
                                                        title={app.booking_type === 'online' ? 'Join Session' : 'Start Session'}
                                                    >
                                                        {app.booking_type === 'online' ? <Video size={16} /> : <PlayCircle size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/doctor/patient-file/${app.patient_id}`)}
                                                        className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm group/btn"
                                                        title="Review Notes"
                                                    >
                                                        <FileSearch size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenRescheduleModal(app)}
                                                        className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm"
                                                        title="Edit Appointment"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                </div>
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
                                            <td colSpan="6" className="py-20 text-center">
                                                <div className="flex flex-col items-center opacity-30">
                                                    <Calendar size={48} className="mb-4" strokeWidth={1} />
                                                    <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">No Appointments Scheduled for Today</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            </div>

            <AnimatePresence>
                {soapModal.isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 10 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
                        >
                            {/* Header */}
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Review Notes</h3>
                                            {soapModal.appointment && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                    {soapModal.appointment.booking_type || 'Offline'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <User size={12} className="text-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{soapModal.appointment?.patient_name}</span>
                                            </div>
                                            {soapModal.appointment?.start_time && (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} className="text-slate-400" />
                                                    <span className="text-[11px] font-bold text-slate-500 tabular-nums uppercase tracking-widest">
                                                        {new Date(soapModal.appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <Users size={12} className="text-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                    {(() => {
                                                        if (!soapModal.appointment) return '--';
                                                        const p = patients.find(pat => String(pat.id) === String(soapModal.appointment.patient_id));
                                                        return p ? `${p.age || '--'} YRS • ${p.gender || '--'} • ${p.contact_number || '--'}` : '--';
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {isRecording && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg shadow-sm border border-red-100">
                                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                                            <span className="text-[11px] font-bold tabular-nums">{formatTime(recordingTime)}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        disabled={isInitializingMic}
                                        className={cn(
                                            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                                            isRecording
                                                ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200"
                                                : "bg-[#062f3f] text-white hover:bg-slate-800 shadow-md shadow-slate-200",
                                            isInitializingMic && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {isInitializingMic ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                                        {isInitializingMic ? "Connecting..." : isRecording ? "Stop Recording" : "Start Recording"}
                                    </button>
                                    <div className="w-px h-6 bg-slate-100 mx-1" />
                                    <button
                                        onClick={() => {
                                            if (isRecording) stopRecording();
                                            if (streamRef.current) {
                                                streamRef.current.getTracks().forEach(t => t.stop());
                                                streamRef.current = null;
                                            }
                                            setSoapModal(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                    >
                                    </button>
                                </div>
                            </div>

                            {/* Tab Switcher */}
                            <div className="flex border-b border-slate-100 bg-slate-50/30 px-8">
                                <button
                                    onClick={() => setSoapModal(prev => ({ ...prev, activeTab: 'notes' }))}
                                    className={cn(
                                        "px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
                                        soapModal.activeTab === 'notes' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    SOAP Notes
                                    {soapModal.activeTab === 'notes' && (
                                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setSoapModal(prev => ({ ...prev, activeTab: 'history' }))}
                                    className={cn(
                                        "px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
                                        soapModal.activeTab === 'history' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Patient History
                                    {soapModal.activeTab === 'history' && (
                                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
                                    )}
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {soapModal.activeTab === 'notes' ? (
                                    <>
                                        {isInitializingMic && (
                                            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-indigo-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                <Loader2 size={16} className="animate-spin" /> Initializing Professional Audio Stream...
                                            </div>
                                        )}
                                        {soapError && (
                                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold uppercase tracking-wide">
                                                <AlertCircle size={16} /> {soapError}
                                            </div>
                                        )}
                                        {soapSuccess && (
                                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-600 text-xs font-bold uppercase tracking-wide">
                                                <CheckCircle2 size={16} /> SOAP Note saved successfully!
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {[
                                                { key: 'subjective', label: 'Subjective', letter: 'S', color: 'text-indigo-600 bg-indigo-50', placeholder: "Patient's reported symptoms and mental state..." },
                                                { key: 'objective', label: 'Objective', letter: 'O', color: 'text-emerald-600 bg-emerald-50', placeholder: "Clinical observations and behavioral notes..." },
                                                { key: 'assessment', label: 'Assessment', letter: 'A', color: 'text-amber-600 bg-amber-50', placeholder: "Clinical interpretation and findings..." },
                                                { key: 'plan', label: 'Plan', letter: 'P', color: 'text-rose-600 bg-rose-50', placeholder: "Treatment steps and follow-up clinical plan..." }
                                            ].map(({ key, label, letter, color, placeholder }) => (
                                                <div key={key} className="flex flex-col">
                                                    <div className="flex items-center gap-2 mb-3 pl-1">
                                                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black", color)}>
                                                            {letter}
                                                        </div>
                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                                                    </div>
                                                    <textarea
                                                        value={soapModal.notes[key]}
                                                        onChange={(e) => setSoapModal(prev => ({ ...prev, notes: { ...prev.notes, [key]: e.target.value } }))}
                                                        placeholder={placeholder}
                                                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all min-h-[140px] placeholder:text-slate-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8 flex flex-col">
                                            <div className="flex items-center gap-2 mb-3 pl-1">
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-cyan-600 bg-cyan-50">
                                                    T
                                                </div>
                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Treatment Plan</span>
                                            </div>
                                            <textarea
                                                value={soapModal.treatment_plan}
                                                onChange={(e) => setSoapModal(prev => ({ ...prev, treatment_plan: e.target.value }))}
                                                placeholder="Long-term treatment strategies and clinical goals..."
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all min-h-[120px] placeholder:text-slate-300"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        {sessionLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                                <Loader2 size={40} className="text-indigo-500 animate-spin" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Clinical History...</p>
                                            </div>
                                        ) : !patientHistory?.current_sessions?.length ? (
                                            <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                                    <History size={32} />
                                                </div>
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">No Previous Sessions</h4>
                                                <p className="text-xs text-slate-500 mt-2 max-w-xs font-medium">This patient doesn't have any historical SOAP notes recorded in our system yet.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {patientHistory.current_sessions.map((session, sIdx) => (
                                                    <div key={session.id} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                        <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Session Date</span>
                                                                    <div className="flex items-center gap-2 text-slate-700 font-black text-sm">
                                                                        <Calendar size={14} className="text-indigo-500" />
                                                                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </div>
                                                                </div>
                                                                <div className="w-px h-8 bg-slate-200" />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Time</span>
                                                                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm tabular-nums">
                                                                        <Clock size={14} className="text-indigo-500" />
                                                                        {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                                Version {session.version}
                                                            </div>
                                                        </div>
                                                        <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6">
                                                            {['subjective', 'objective', 'assessment', 'plan'].map(field => (
                                                                <div key={field} className="space-y-2">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1">
                                                                        {field}
                                                                    </span>
                                                                    <div className="p-4 bg-slate-50 rounded-2xl text-[13px] font-bold text-slate-700 leading-relaxed min-h-[60px]">
                                                                        {session.soap_notes?.[field] || <span className="text-slate-300 italic font-medium">No {field} notes recorded.</span>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {session.treatment_plan && (
                                                            <div className="px-8 pb-8">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">
                                                                    treatment plan
                                                                </span>
                                                                <div className="p-4 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl text-[13px] font-bold text-slate-700 leading-relaxed">
                                                                    {session.treatment_plan}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <button
                                    onClick={() => {
                                        if (isRecording) stopRecording();
                                        if (streamRef.current) {
                                            streamRef.current.getTracks().forEach(t => t.stop());
                                            streamRef.current = null;
                                        }
                                        setSoapModal(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                                >
                                    Cancel
                                </button>
                                {soapModal.activeTab === 'notes' && (
                                    <button
                                        onClick={() => handleSoapSubmit()}
                                        disabled={isSavingSoap}
                                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200 hover:bg-slate-800 transition-all flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {isSavingSoap ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        Save SOAP Note
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Latest Session Modal */}
            <AnimatePresence>
                {latestSessionModal.isOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 10 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
                        >
                            {/* Header */}
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600">
                                        <History size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Latest Session Versions History</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <User size={12} className="text-slate-400" />
                                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{latestSessionModal.patient_name}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setLatestSessionModal({ isOpen: false, patient_id: null, patient_name: '' })}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                                {sessionLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <Loader2 size={40} className="text-cyan-500 animate-spin" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Version History...</p>
                                    </div>
                                ) : !(patientHistory?.version_history?.length || patientHistory?.current_sessions?.length) ? (
                                    <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                            <History size={32} />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">No History Found</h4>
                                        <p className="text-xs text-slate-500 mt-2 max-w-xs font-medium">There are no recorded sessions or version history for this patient yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {[...(patientHistory?.current_sessions || []), ...(patientHistory?.version_history || [])]
                                            .sort((a, b) => new Date(b.saved_at || b.date || 0) - new Date(a.saved_at || a.date || 0))
                                            .map((version, index) => (
                                                <div key={`${version.id}-${index}`} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                    <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                                                    {version.saved_at ? 'Saved At' : 'Session Date'}
                                                                </span>
                                                                <div className="flex items-center gap-2 text-slate-700 font-black text-sm">
                                                                    <Calendar size={14} className="text-cyan-500" />
                                                                    {new Date(version.saved_at || version.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </div>
                                                            </div>
                                                            <div className="w-px h-8 bg-slate-200" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Time</span>
                                                                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm tabular-nums">
                                                                    <Clock size={14} className="text-cyan-500" />
                                                                    {new Date(version.saved_at || version.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="px-3 py-1 bg-cyan-50 text-cyan-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-cyan-100">
                                                            Version {version.version_number || version.version || 1}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="p-8 space-y-6">
                                                        {version.soap_notes && Object.keys(version.soap_notes).some(k => version.soap_notes[k]) && (
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">SOAP Notes</span>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {['subjective', 'objective', 'assessment', 'plan'].map(field => version.soap_notes[field] ? (
                                                                        <div key={field} className="p-4 bg-slate-50 rounded-2xl">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">{field}</span>
                                                                            <p className="text-[13px] font-medium text-slate-700">{version.soap_notes[field]}</p>
                                                                        </div>
                                                                    ) : null)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {version.treatment_plan && (
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">Treatment Plan</span>
                                                                <div className="p-4 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl text-[13px] font-bold text-slate-700">
                                                                    {version.treatment_plan}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {version.summary && (
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">Summary</span>
                                                                <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl text-[13px] font-bold text-slate-700 whitespace-pre-wrap">
                                                                    {version.summary}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {version.transcript && (
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">Transcript</span>
                                                                <div className="p-4 bg-slate-50 rounded-2xl text-[13px] font-medium text-slate-600 max-h-40 overflow-y-auto custom-scrollbar">
                                                                    {version.transcript}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {version.notes && (
                                                            <div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">Notes</span>
                                                                <div className="p-4 bg-amber-50/50 border border-amber-100/50 rounded-2xl text-[13px] font-medium text-slate-700">
                                                                    {version.notes}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AppointmentModal
                isOpen={rescheduleModal.isOpen}
                onClose={() => setRescheduleModal({ isOpen: false, appointment: null })}
                initialData={rescheduleModal.appointment}
                isRescheduling={true}
                doctorOverride={currentDoctor}
            />
        </motion.div>
    );
}
