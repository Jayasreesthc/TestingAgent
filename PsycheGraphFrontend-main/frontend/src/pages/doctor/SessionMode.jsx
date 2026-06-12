import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { createSoapNote, uploadAudio, fetchTranscript, updateAppointmentStatus } from '../../store/slices/SessionSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import {
    Mic,
    Square,
    Save,
    FileText,
    Tag,
    PlayCircle,
    PauseCircle,
    Loader2,
    Flag,
    Plus,
    Clock,
    Calendar,
    ChevronRight,
    ChevronLeft,
    Search,
    AlertCircle,
    History,
    X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function DoctorSessionMode() {
    const { appointmentId, patientId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: patients } = useSelector((state) => state.patients);
    const { user: authUser } = useSelector((state) => state.auth);

    // --- State ---
    const [patient, setPatient] = useState(null);

    // Session Tracking
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = useState(false);
    const [sessionTime, setSessionTime] = useState(0);

    // Recording Tracking
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const recognitionRef = useRef(null);

    // Live Transcript Data
    const [transcriptText, setTranscriptText] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');

    // Clinical Documentation (SOAP)
    const [soapNotes, setSoapNotes] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });
    const [generalNotes, setGeneralNotes] = useState('');
    const [treatmentPlan, setTreatmentPlan] = useState('');

    // Theme Flagging
    const predefinedThemes = [
        'Anxiety', 'Depression', 'Trauma', 'Grief',
        'Anger', 'Self-harm', 'Suicidal Ideation',
        'Substance Use', 'Relationship Issues', 'Sleep Issues'
    ];
    const [customTheme, setCustomTheme] = useState('');
    const [flaggedThemes, setFlaggedThemes] = useState([]);
    const [showReviewModal, setShowReviewModal] = useState(false);

    const [saving, setSaving] = useState(false);

    // Debug Mount
    useEffect(() => {
        console.log("DoctorSessionMode mounted with params:", { appointmentId, patientId });
    }, [appointmentId, patientId]);

    // Initialize patient data
    useEffect(() => {
        if (!patients || patients.length === 0) {
            dispatch(fetchPatients());
        } else {
            const p = patients.find(p => String(p.id) === String(patientId));
            if (p) setPatient(p);
        }
    }, [patients, patientId, dispatch]);

    // --- Timer Logic ---
    // Session Timer
    useEffect(() => {
        if (isSessionActive && !isPaused) {
            timerRef.current = setInterval(() => {
                setSessionTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isSessionActive, isPaused]);

    // Recording Timer
    useEffect(() => {
        if (isRecording && !isRecordingPaused && mediaRecorderRef.current?.state === 'recording') {
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(recordingTimerRef.current);
        }
        return () => clearInterval(recordingTimerRef.current);
    }, [isRecording, isRecordingPaused]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // --- Recording & STT Logic ---
    const startSession = () => {
        setIsSessionActive(true);
        setIsPaused(false);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.start(1000); // Collect every second
            setIsRecording(true);

            // Speech Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;

                recognitionRef.current.onresult = (event) => {
                    let finalBlock = '';
                    let interimBlock = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) finalBlock += event.results[i][0].transcript + ' ';
                        else interimBlock += event.results[i][0].transcript;
                    }
                    if (finalBlock) {
                        setTranscriptText(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + finalBlock);
                    }
                    setInterimTranscript(interimBlock);
                };
                recognitionRef.current.start();
            }
        } catch (err) {
            console.error('Microphone access denied:', err);
            alert("Microphone access is required for clinical recording.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsRecording(false);
    };

    const pauseSession = () => {
        setIsPaused(true);
    };

    const resumeSession = () => {
        setIsPaused(false);
    };

    const pauseRecording = () => {
        setIsRecordingPaused(true);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
        }
        if (recognitionRef.current) recognitionRef.current.stop();
    };

    const resumeRecording = () => {
        setIsRecordingPaused(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
        }
        if (recognitionRef.current) recognitionRef.current.start();
    };

    // --- Action Handlers ---
    const handleAddFlag = (theme) => {
        if (!theme.trim()) return;
        setFlaggedThemes(prev => [...prev, {
            timestamp: formatTime(sessionTime),
            theme: theme.trim()
        }]);
        setCustomTheme('');
    };

    const handleSaveSoap = async () => {
        setSaving(true);
        try {
            // Stop hardware
            if (recognitionRef.current) recognitionRef.current.stop();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // Assembly Theme Flag String
            // Requirements: "selected theme : timer"
            const themeFlagString = flaggedThemes.map(f => `${f.theme}: ${f.timestamp}`).join(', ');

            // Payload assembly matching backend requirements
            const payload = {
                patient_id: Number(patientId),
                doctor_id: Number(authUser?.id || authUser?.doctor_id),
                appointment_id: Number(appointmentId),
                soap_notes: {
                    ...soapNotes
                },
                notes: generalNotes,
                treatment_plan: treatmentPlan,
                time_duration: sessionTime,
                flags_data: themeFlagString || "null" // Backend renamed this
            };

            const createdSession = await dispatch(createSoapNote(payload)).unwrap();
            const sessionId = createdSession.id;

            // Optional: Upload audio if captured
            if (chunksRef.current.length > 0) {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                // Pass the actual sessionId returned from the POST /sessions/ call
                await dispatch(uploadAudio({ sessionId, audioBlob })).unwrap();
            }

            // ✅ Update appointment status
            await dispatch(updateAppointmentStatus({ appointmentId, status: 'COMPLETED' })).unwrap();

            // Redirect to Patient Directory immediately
            navigate('/doctor/patients');
        } catch (err) {
            console.error('Failed to save SOAP notes:', err);
            alert("Failed to save session data. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] w-full bg-white flex flex-col overflow-hidden relative">
            {/* Header / Timer Bar - Fixed at the top of the module */}
            <header className="bg-white border-b border-slate-100 px-4 md:px-8 py-4 flex flex-wrap items-center justify-between z-20 gap-4 shrink-0">
                <div className="flex items-center gap-4 md:gap-6 flex-wrap w-full">
                    <button
                        onClick={() => navigate('/doctor')}
                        className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all group border border-transparent hover:border-indigo-100"
                        title="Back to Dashboard"
                    >
                        <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <div className="flex flex-col min-w-[120px]">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                                Live Session
                            </h1>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-indigo-100">
                                Active
                            </span>
                        </div>
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-0.5 truncate max-w-[150px] md:max-w-none">
                            Patient: <span className="text-slate-600">{patient?.full_name || 'Loading...'}</span>
                        </p>
                    </div>

                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-2 rounded-2xl">
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Elapsed</span>
                                <span className="text-lg font-black text-slate-800 tabular-nums leading-none">{formatTime(sessionTime)}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-200" />
                            {!isSessionActive ? (
                                <button onClick={startSession} className="h-8 w-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-slate-900 transition-all shadow-md" title="Start Session">
                                    <PlayCircle size={16} fill="currentColor" />
                                </button>
                            ) : isPaused ? (
                                <button onClick={resumeSession} className="h-8 w-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-md" title="Resume Session">
                                    <PlayCircle size={16} fill="currentColor" />
                                </button>
                            ) : (
                                <button onClick={pauseSession} className="h-8 w-8 bg-amber-500 text-white rounded-xl flex items-center justify-center hover:bg-amber-600 transition-all shadow-md" title="Pause Session">
                                    <PauseCircle size={16} fill="currentColor" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pr-2">
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID: {appointmentId}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 flex flex-col xl:flex-row overflow-hidden">
                {/* Unified Documentation Panel */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white border-r border-slate-100">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-10">

                        {/* Compact Live STT Monitor */}
                        {/* {isSessionActive && (
                            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Transcription Feed</span>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setGeneralNotes(prev => prev + (prev ? "\n\n" : "") + transcriptText);
                                            setTranscriptText("");
                                        }}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                    >
                                        <Save size={12} /> Append to General Notes
                                    </button>
                                </div>
                                <p className="text-sm font-medium leading-relaxed text-slate-200 min-h-[40px]">
                                    {interimTranscript || transcriptText || <span className="text-slate-500 italic">Listening for speech...</span>}
                                </p>
                               
                                <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-1 px-4">
                                    {[...Array(20)].map((_, i) => (
                                        <div key={i} className="flex-1 bg-indigo-500/20" style={{ height: Math.random() * 100 + '%' }} />
                                    ))}
                                </div>
                            </div>
                        )} */}

                        {/* Line-by-Line Documentation */}
                        <div className="space-y-8">
                            {/* Compact Audio Capture Row */}
                            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 mb-6">
                                <div className="h-8 w-8 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 shrink-0">
                                    <Mic size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">Audio Capture</span>
                                    <span className={cn("text-xs font-bold tabular-nums", isRecording ? "text-rose-500" : "text-slate-400")}>{formatTime(recordingTime)}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {!isRecording ? (
                                        <button
                                            onClick={startRecording}
                                            disabled={!isSessionActive}
                                            className="h-8 px-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50"
                                        >
                                            <PlayCircle size={14} fill="currentColor" /> Start
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {isRecordingPaused ? (
                                                <button onClick={resumeRecording} className="h-8 w-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all" title="Resume">
                                                    <PlayCircle size={14} fill="currentColor" />
                                                </button>
                                            ) : (
                                                <button onClick={pauseRecording} className="h-8 w-8 bg-amber-500 text-white rounded-xl flex items-center justify-center hover:bg-amber-600 transition-all" title="Pause">
                                                    <PauseCircle size={14} fill="currentColor" />
                                                </button>
                                            )}
                                            <button onClick={stopRecording} className="h-8 px-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-rose-700 transition-all">
                                                <Square size={12} fill="currentColor" /> Stop
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {[
                                { key: 'subjective', label: 'Subjective Notes', letter: 'S', color: 'bg-indigo-600' },
                                { key: 'objective', label: 'Objective Notes', letter: 'O', color: 'bg-emerald-600' },
                                { key: 'assessment', label: 'Assessment Notes', letter: 'A', color: 'bg-amber-500' },
                                { key: 'plan', label: 'Clinical Plan', letter: 'P', color: 'bg-rose-500' }
                            ].map((field) => (
                                <div key={field.key} className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg", field.color)}>
                                            {field.letter}
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{field.label}</h3>
                                    </div>
                                    <textarea
                                        value={soapNotes[field.key]}
                                        onChange={(e) => setSoapNotes(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={`Enter ${field.key} findings here...`}
                                        className="w-full min-h-[140px] p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-300 shadow-sm"
                                    />
                                </div>
                            ))}

                            <div className="h-px bg-slate-100 my-10" />

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg bg-slate-800">
                                        N
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">General Notes</h3>
                                </div>
                                <textarea
                                    value={generalNotes}
                                    onChange={(e) => setGeneralNotes(e.target.value)}
                                    placeholder="Any additional observations or metadata..."
                                    className="w-full min-h-[180px] p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all placeholder:text-slate-300"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg bg-cyan-600">
                                        T
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Treatment Plan</h3>
                                </div>
                                <textarea
                                    value={treatmentPlan}
                                    onChange={(e) => setTreatmentPlan(e.target.value)}
                                    placeholder="Next steps, medications, or referrals..."
                                    className="w-full min-h-[140px] p-6 bg-cyan-50/30 border border-cyan-100 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-cyan-500/5 focus:bg-white focus:border-cyan-400 transition-all placeholder:text-cyan-200 text-slate-700 shadow-sm"
                                />
                            </div>

                            {/* End Session Button */}
                            <div className="pt-6 pb-4 flex items-center justify-center">
                                <button
                                    onClick={() => { pauseSession(); pauseRecording(); setShowReviewModal(true); }}
                                    disabled={!isSessionActive || saving}
                                    className="h-11 px-8 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 shadow-lg shadow-rose-100 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    <Square size={14} fill="currentColor" /> End Session & Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Themes & Flags */}
                <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-slate-200 bg-white flex flex-col overflow-hidden max-h-[60vh] xl:max-h-none">
                    {/* Theme Selector Dropdown + Custom Tag */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                        <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <Tag size={13} className="text-indigo-500" /> Clinical Themes
                        </h2>
                        <div className="flex gap-2">
                            <select
                                onChange={(e) => { if (e.target.value) { handleAddFlag(e.target.value); e.target.value = ''; } }}
                                defaultValue=""
                                className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all appearance-none"
                            >
                                <option value="" disabled>Select a theme...</option>
                                {predefinedThemes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="mt-2 flex gap-2">
                            <input
                                type="text"
                                value={customTheme}
                                onChange={(e) => setCustomTheme(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddFlag(customTheme)}
                                placeholder="Custom tag..."
                                className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                            />
                            <button
                                onClick={() => handleAddFlag(customTheme)}
                                className="h-9 w-9 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 transition-all"
                            >
                                <Plus size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Timeline Flags */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Timeline Flags</h3>
                            <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg">
                                {flaggedThemes.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-[#f8fafc]">
                            {flaggedThemes.length === 0 ? (
                                <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-center px-4">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 shadow-sm border border-slate-100 mb-4">
                                        <Flag size={32} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                                        No flags added to <br /> this session yet
                                    </p>
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {flaggedThemes.slice().reverse().map((flag, idx) => (
                                        <motion.div
                                            key={flaggedThemes.length - 1 - idx} // Use a stable key that represents the index in the original array
                                            layout
                                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            className={cn(
                                                "p-4 rounded-2xl border transition-all relative overflow-hidden group",
                                                idx === 0
                                                    ? "bg-indigo-600 border-indigo-700 shadow-lg shadow-indigo-100 text-white"
                                                    : "bg-white border-slate-200 text-slate-700 hover:border-indigo-200"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className={cn(
                                                    "px-2 py-1 rounded text-[10px] font-black tabular-nums tracking-widest",
                                                    idx === 0 ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600"
                                                )}>
                                                    {flag.timestamp}
                                                </div>
                                                {idx === 0 && (
                                                    <div className="flex items-center gap-1.5 animate-pulse">
                                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                                        <span className="text-[8px] font-black uppercase tracking-widest opacity-80">Latest Flag</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className={cn(
                                                "text-xs md:text-sm font-black uppercase tracking-tight",
                                                idx === 0 ? "text-white" : "text-slate-800"
                                            )}>
                                                {flag.theme}
                                            </p>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {/* Review Modal Placeholder - High Fidelity Overlay */}
            <AnimatePresence>
                {showReviewModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowReviewModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl relative z-10 flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Session Review</h2>
                                    <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-[10px]">Verify details before clinical archival</p>
                                </div>
                                <button
                                    onClick={() => setShowReviewModal(false)}
                                    className="h-12 w-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                                {/* Summary Grid */}
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patient</span>
                                        <p className="text-lg font-black text-slate-800">{patient?.full_name}</p>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Appointment ID</span>
                                        <p className="text-lg font-black text-slate-800">#{appointmentId}</p>
                                    </div>
                                    <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Total Duration</span>
                                        <p className="text-lg font-black text-indigo-600 tabular-nums">{formatTime(sessionTime)}</p>
                                    </div>
                                </div>

                                {/* SOAP Sections */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full" /> Clinical Documentation (SOAP)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-8">
                                        {[
                                            { label: 'Subjective', value: soapNotes.subjective, color: 'text-indigo-600' },
                                            { label: 'Objective', value: soapNotes.objective, color: 'text-emerald-600' },
                                            { label: 'Assessment', value: soapNotes.assessment, color: 'text-amber-600' },
                                            { label: 'Plan', value: soapNotes.plan, color: 'text-rose-600' }
                                        ].map(item => (
                                            <div key={item.label} className="space-y-2">
                                                <span className={cn("text-[10px] font-black uppercase tracking-widest", item.color)}>{item.label}</span>
                                                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 min-h-[80px] text-sm font-medium text-slate-600 leading-relaxed italic">
                                                    {item.value || "Not documented"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Tags/Themes Flagging */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-slate-900 rounded-full" /> Clinical Themes Flagged
                                    </h3>
                                    <div className="p-6 bg-slate-900 rounded-3xl flex flex-wrap gap-3">
                                        {flaggedThemes.length === 0 ? (
                                            <span className="text-slate-500 text-xs italic">No themes flagged during this session.</span>
                                        ) : (
                                            flaggedThemes.map((f, idx) => (
                                                <div key={idx} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                    <span>{f.theme}</span>
                                                    <span className="opacity-60 text-[9px]">{f.timestamp}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* General Notes & Treatment Plan */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">General Notes</h3>
                                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 min-h-[120px] text-sm font-medium text-slate-600 whitespace-pre-wrap">
                                            {generalNotes || "No general notes."}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">Treatment Plan</h3>
                                        <div className="p-6 bg-cyan-50/50 rounded-3xl border border-cyan-100 min-h-[120px] text-sm font-medium text-slate-700 whitespace-pre-wrap">
                                            {treatmentPlan || "No specific treatment plan."}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                                <button
                                    onClick={() => setShowReviewModal(false)}
                                    className="px-8 py-4 bg-white text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all"
                                >
                                    Edit Session Data
                                </button>
                                <button
                                    onClick={handleSaveSoap}
                                    disabled={saving}
                                    className="px-12 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center gap-3"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Confirm & Save to Records
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

