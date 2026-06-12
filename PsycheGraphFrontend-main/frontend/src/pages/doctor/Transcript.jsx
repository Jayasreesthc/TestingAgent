import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchSessions, fetchSessionById, createSoapNote, uploadAudio } from '../../store/slices/SessionSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Calendar, FileText, Mic, Loader2, ChevronDown, Search,
    Radio, PlayCircle, PauseCircle, StopCircle, Flag, Clock, Plus, Tag,
    CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function Transcript() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list: patients } = useSelector((state) => state.patients);
    const { list: appointments } = useSelector((state) => state.appointments);
    const { list: sessions, loading: sessionsLoading } = useSelector((state) => state.sessions);
    const { user: authUser } = useSelector((state) => state.auth);

    // Standard Selection State
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [transcript, setTranscript] = useState('');
    const [sessionDetails, setSessionDetails] = useState(null);
    const [loadingTranscript, setLoadingTranscript] = useState(false);

    // === LIVE SESSION MODULE STATE ===
    const [isLiveMode, setIsLiveMode] = useState(false);
    
    // Timer
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerRef = useRef(null);

    // Audio & STT
    const [isRecording, setIsRecording] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);

    // Theme Flagging
    const defaultThemes = ["Anxiety", "Stress", "Depression", "Trauma", "Relationships"];
    const [flaggedMoments, setFlaggedMoments] = useState([]);
    const [customTheme, setCustomTheme] = useState('');

    // End Session State
    const [isSavingSession, setIsSavingSession] = useState(false);
    const [savedSessionSuccess, setSavedSessionSuccess] = useState(false);

    // Filter patients by name, email, and contact number
    const filteredPatients = patients.filter(p =>
        (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.contact_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        dispatch(fetchPatients());
    }, [dispatch]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (selectedPatientId) {
                setLoadingTranscript(true);
                try {
                    const result = await dispatch(fetchSessions(selectedPatientId)).unwrap();
                    if (result && result.length > 0) {
                        // Sort by version descending to get the latest version
                        const sortedSessions = [...result].sort((a, b) => (b.version || 0) - (a.version || 0));
                        const latestSession = sortedSessions[0];
                        setSessionDetails(latestSession);
                        setTranscript(latestSession.transcript || '');
                    } else {
                        setSessionDetails(null);
                        setTranscript('');
                    }
                } catch (err) {
                    console.error('Failed to auto-load session:', err);
                    setSessionDetails(null);
                    setTranscript('');
                } finally {
                    setLoadingTranscript(false);
                }
            } else {
                setSessionDetails(null);
                setTranscript('');
            }
        };
        loadInitialData();
    }, [selectedPatientId, dispatch]);

    // Fetch appointments when patient selected (for binding the session)
    useEffect(() => {
        if (selectedPatientId) {
            dispatch(fetchAppointments());
        }
    }, [selectedPatientId, dispatch]);

    // Format utility
    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '00:00:00';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // --- LIVE SESSION TIMER & RECORDING ---
    useEffect(() => {
        if (isTimerRunning) {
            timerRef.current = setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
        } else if (!isTimerRunning && timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isTimerRunning]);

    const startLiveRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.start(1000); // collect chunks every second
            setIsRecording(true);
            setIsTimerRunning(true);

            // Web Speech API STT (Fallback to continuous text entry)
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                
                recognitionRef.current.onresult = (event) => {
                    let finalTranscript = '';
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
                        else interimTranscript += event.results[i][0].transcript;
                    }
                    if (finalTranscript) {
                        setLiveTranscript(prev => prev + (prev.endsWith(' ') ? '' : ' ') + finalTranscript);
                    }
                };
                recognitionRef.current.start();
            }
        } catch (err) {
            console.error("Microphone access denied or Speech API failed:", err);
            alert("Microphone access is required for live recording and STT.");
        }
    };

    const pauseLiveRecording = () => {
        setIsTimerRunning(false);
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
        }
        if (recognitionRef.current) recognitionRef.current.stop();
    };

    const resumeLiveRecording = () => {
        setIsTimerRunning(true);
        setIsRecording(true);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
        }
        if (recognitionRef.current) recognitionRef.current.start();
    };

    const handleThemeFlag = (themeStr) => {
        if (!themeStr.trim()) return;
        setFlaggedMoments(prev => [...prev, { timeStr: formatTime(timeElapsed), theme: themeStr.trim() }]);
        setCustomTheme('');
    };

    const handleEndSession = async () => {
        if (!selectedPatientId) return alert("Please select a patient first.");
        
        setIsTimerRunning(false);
        setIsRecording(false);
        setIsSavingSession(true);

        // Stop all recording hardware
        if (recognitionRef.current) recognitionRef.current.stop();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        // We bind the session to the latest appointment of this patient
        const patientAppointments = appointments.filter(a => String(a.patient_id) === String(selectedPatientId));
        patientAppointments.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        const activeAppointment = patientAppointments[0];

        if (!activeAppointment) {
            setIsSavingSession(false);
            return alert("No active appointment found for this patient to bind the session.");
        }

        try {
            // Build the flagged moments string
            const formattedFlags = flaggedMoments.map(f => `[${f.timeStr}] Flagged Theme: ${f.theme}`).join('\n');

            // 1. Create the session base
            const sessionPayload = {
                patient_id: selectedPatientId,
                doctor_id: authUser?.id || authUser?.doctor_id,
                appointment_id: activeAppointment.id,
                soap_notes: {
                    subjective: liveTranscript, // Storing raw transcript in subjective (or keep empty if purely transcript block)
                    objective: `Live Theme Flags:\n${formattedFlags}`,
                    assessment: '',
                    plan: ''
                }
            };
            const createdSession = await dispatch(createSoapNote(sessionPayload)).unwrap();
            const sessionId = createdSession.id;

            // Wait a small buffer for recorder to finish data compiling
            await new Promise(r => setTimeout(r, 500)); 

            // 2. Upload the audio file generated by MediaRecorder
            if (audioChunksRef.current.length > 0) {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await dispatch(uploadAudio({ session_id: sessionId, audioBlob })).unwrap();
            }

            setSavedSessionSuccess(true);
        } catch (err) {
            console.error("Failed closing session:", err);
            alert("Failed to save session. See console.");
        } finally {
            setIsSavingSession(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col p-8 overflow-y-auto">
            {/* Page Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-inter">
                        {isLiveMode ? 'Live Session Dashboard' : 'Clinical Transcripts'}
                    </h1>
                    <p className="text-slate-500 font-medium font-inter">
                        {isLiveMode ? 'Conduct real-time sessions and active theme tagging.' : 'Review and analyze past session conversations.'}
                    </p>
                </div>
                {!savedSessionSuccess && (
                    <button
                        onClick={() => {
                            if (!selectedPatientId) return alert("Please select a patient first.");
                            navigate(`/doctor/session/0/${selectedPatientId}`);
                        }}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm",
                            isLiveMode 
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                                : "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20"
                        )}
                    >
                        {isLiveMode ? (
                            <>Exit Live Session</>
                        ) : (
                            <><Radio size={18} className="animate-pulse" /> Start Live Session</>
                        )}
                    </button>
                )}
            </div>

            {/* Selection Bar */}
            <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 mb-8 flex flex-col lg:flex-row items-center gap-8">
                <div className="w-full space-y-3 relative overflow-visible">
                    <div className="flex items-center gap-2 px-1">
                        <User size={14} className="text-primary-600" />
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Select Patient <span className="text-rose-500">*</span></label>
                    </div>
                    <div className="relative group">
                        <div className="relative">
                            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors pointer-events-none" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (!isOpen) setIsOpen(true);
                                }}
                                onFocus={() => setIsOpen(true)}
                                placeholder="Search by name, email or phone..."
                                className="w-full h-14 pl-14 pr-10 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-slate-600 font-medium focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/30 focus:bg-white outline-none transition-all cursor-text appearance-none"
                            />
                            <ChevronDown 
                                size={18} 
                                className={cn(
                                    "absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-300 pointer-events-none",
                                    isOpen && "rotate-180"
                                )} 
                            />
                        </div>

                        <AnimatePresence>
                            {isOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => {
                                            setIsOpen(false);
                                            // Reset search term to selected patient name if exists
                                            const selected = patients.find(p => String(p.id) === String(selectedPatientId));
                                            if (selected) setSearchTerm(selected.full_name);
                                            else if (!selectedPatientId) setSearchTerm('');
                                        }}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden z-50 max-h-[300px] overflow-y-auto custom-scrollbar"
                                    >
                                        <div className="p-2">
                                            {filteredPatients.length > 0 ? (
                                                filteredPatients.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedPatientId(p.id);
                                                            setSearchTerm(p.full_name);
                                                            setIsOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full text-left px-4 py-3 rounded-xl transition-all flex flex-col gap-0.5",
                                                            String(p.id) === String(selectedPatientId)
                                                                ? "bg-primary-50 text-primary-900"
                                                                : "hover:bg-slate-50 text-slate-700"
                                                        )}
                                                    >
                                                        <span className="font-bold text-sm">{p.full_name}</span>
                                                        <div className="flex items-center gap-3 text-[10px] opacity-60 font-medium">
                                                            <span>{p.email || 'No email'}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span>{p.contact_number || 'No phone'}</span>
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-8 text-center">
                                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching patients</p>
                                                    <p className="text-[10px] text-slate-300 font-medium mt-1">Try a different name, email or phone</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {loadingTranscript && <Loader2 className="animate-spin text-primary-500" size={24} />}
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[600px]">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <FileText size={20} className="text-primary-500" />
                        <h2 className="text-lg font-black text-slate-800">Transcript Content</h2>
                    </div>
                    {sessionDetails && (
                        <div className="px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary-100">
                                #{sessionDetails.appointment_id || sessionDetails.id}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-white">
                    {!selectedPatientId ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                            <Search size={48} className="mb-4 text-slate-400" />
                            <p className="text-lg font-bold text-slate-400 uppercase tracking-widest">Select a patient and session to view content</p>
                        </div>
                    ) : loadingTranscript ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <Loader2 size={48} className="animate-spin text-primary-500 mb-4" />
                            <p className="text-lg font-bold text-slate-500">Fetching clinical data...</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {/* SOAP Notes Sections (S, O, A, P) */}
                            {(() => {
                                const soap = sessionDetails?.soap_notes || {};
                                const fields = [
                                    { key: 'subjective', label: 'Subjective', letter: 'S' },
                                    { key: 'objective', label: 'Objective', letter: 'O' },
                                    { key: 'assessment', label: 'Assessment', letter: 'A' },
                                    { key: 'plan', label: 'Plan', letter: 'P' },
                                ];

                                return (
                                    <div className="space-y-8 pb-12 border-b border-slate-50">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {fields.map(({ key, label, letter }) => (
                                                <div key={key} className="space-y-3 p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-primary-100 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-xl bg-[#6366f1] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-primary-500/20 uppercase">
                                                            {letter}
                                                        </div>
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{label}</h3>
                                                    </div>
                                                    <p className="text-slate-600 font-medium leading-relaxed min-h-[60px]">
                                                        {soap[key] || <span className="text-slate-300 italic">No notes recorded for this section</span>}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Treatment Plan Section */}
                                        {sessionDetails?.treatment_plan && (
                                            <div className="space-y-3 p-6 rounded-[1.5rem] bg-cyan-50/30 border border-cyan-100/50 hover:bg-white hover:shadow-md hover:border-cyan-200 transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-cyan-500/20 uppercase">
                                                        T
                                                    </div>
                                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Treatment Plan</h3>
                                                </div>
                                                <p className="text-slate-600 font-medium leading-relaxed">
                                                    {sessionDetails.treatment_plan}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Transcript Section */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-3 px-2">
                                    <Mic size={18} className="text-primary-500" />
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Session Transcript</h3>
                                </div>
                                {transcript.length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
                                        <Mic size={48} className="mb-4 text-slate-400" />
                                        <p className="text-lg font-bold text-slate-400 uppercase tracking-widest">No conversation data found</p>
                                    </div>
                                ) : Array.isArray(transcript) ? (
                                    transcript.map((entry, idx) => (
                                        <div key={idx} className="flex gap-4 group">
                                            <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0 pt-1 w-16 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatTime(entry.time)}
                                            </span>
                                            <div className="flex flex-col gap-1.5 flex-1">
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-[0.15em] mb-1",
                                                    (entry.speaker === 'Doctor' || entry.speaker === 'Practitioner') ? "text-[#2563eb]" : "text-[#10b981]"
                                                )}>
                                                    {entry.speaker === 'Doctor' ? 'Practitioner' : entry.speaker}
                                                </span>
                                                <p className="text-slate-600 font-medium leading-relaxed max-w-3xl">
                                                    {entry.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                        <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-wrap italic">
                                            "{transcript}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
