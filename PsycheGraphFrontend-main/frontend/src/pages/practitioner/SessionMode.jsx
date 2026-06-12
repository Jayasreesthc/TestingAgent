import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { createSession, fetchTranscript } from '../../store/slices/SessionSlice';
import {
    Mic,
    Square,
    Save,
    FileText,
    Tag,
    PlayCircle,
    Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function PractitionerSessionMode() {
    const { appointmentId, patientId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: patients } = useSelector((state) => state.patients);

    // Derived Data
    const patient = patients.find(p => String(p.id) === String(patientId)) || { full_name: 'Unknown Patient' };

    // --- State ---
    // Recording & Timer
    const [isRecording, setIsRecording] = useState(false);
    const [sessionTime, setSessionTime] = useState(0); // in seconds
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    // Live Transcript Data
    const [transcript, setTranscript] = useState([]);

    // Quick Notes
    const [quickNotes, setQuickNotes] = useState('');

    // Predefined Themes for flagging
    const predefinedThemes = [
        'Anxiety', 'Depression', 'Trauma',
        'Grief', 'Anger', 'Self-harm',
        'Suicidal Ideation', 'Substance Use',
        'Relationship Issues', 'Sleep Issues'
    ];

    const [clinicalThemes, setClinicalThemes] = useState([]);
    const [saving, setSaving] = useState(false);

    // Fetch existing transcript on mount if appointmentId exists
    useEffect(() => {
        if (appointmentId) {
            dispatch(fetchTranscript(appointmentId))
                .unwrap()
                .then((data) => {
                    if (data && Array.isArray(data)) {
                        setTranscript(data);
                    } else if (data && typeof data === 'object' && data.transcript) {
                        setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
                    }
                })
                .catch(err => {
                    console.error('Failed to pre-fetch transcript:', err);
                });
        }
    }, [appointmentId, dispatch]);

    // --- Timer Logic ---
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setSessionTime(prev => prev + 1);

                // Mock live transcription injection for demo purposes
                if (Math.random() > 0.8) {
                    const mockSentences = [
                        "Patient indicated high anxiety levels today.",
                        "Discussed previous week's challenges.",
                        "Sleep patterns remain inconsistent.",
                        "Reviewing coping mechanisms established last session."
                    ];
                    setTranscript(prev => [...prev, {
                        time: sessionTime,
                        text: mockSentences[Math.floor(Math.random() * mockSentences.length)],
                        speaker: Math.random() > 0.5 ? 'Practitioner' : 'Patient'
                    }]);
                }
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // --- Recording Logic ---
    const startSession = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setIsRecording(true);
        }
    };

    const stopSession = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    // --- Action Handlers ---
    const toggleTheme = (theme) => {
        if (clinicalThemes.includes(theme)) {
            setClinicalThemes(clinicalThemes.filter(t => t !== theme));
        } else {
            setClinicalThemes([...clinicalThemes, theme]);
        }
    };

    const handleSaveSessionData = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('patient_id', patientId);
            formData.append('duration', sessionTime);
            formData.append('quick_notes', quickNotes);
            formData.append('themes', JSON.stringify(clinicalThemes));
            formData.append('transcript', JSON.stringify(transcript));

            if (audioBlob) {
                formData.append('file', audioBlob, `session_${patientId}_${Date.now()}.wav`);
            }

            // Mock saving delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            await dispatch(createSession(formData)).unwrap();
            navigate('/practitioner/patients');
        } catch (err) {
            console.error('Failed to save session:', err);
            alert("Failed to save session data.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col p-8 overflow-y-auto">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Live Session</h1>
                <p className="text-slate-500 font-medium">Conduct and document therapy sessions in real-time</p>
            </div>

            {/* Control Bar Card */}
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="w-full sm:w-64">
                    <select
                        value={patientId}
                        onChange={(e) => navigate(`/practitioner/session/${appointmentId || '0'}/${e.target.value}`)}
                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-primary-500/20 outline-none transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[position:right_1rem_center]"
                    >
                        <option value="">Select Patient</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-8">
                    <div className="text-4xl font-black text-slate-800 tabular-nums tracking-tight">
                        {formatTime(sessionTime)}
                    </div>

                    <div className="flex items-center gap-3">
                        {!isRecording ? (
                            <button
                                onClick={startSession}
                                className="bg-[#10b981] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                            >
                                <PlayCircle size={20} fill="currentColor" />
                                Start
                            </button>
                        ) : (
                            <button
                                onClick={stopSession}
                                className="bg-[#ef4444] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                            >
                                <Square size={20} fill="currentColor" />
                                Stop
                            </button>
                        )}
                        <button className="p-3 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
                            <Mic size={20} />
                        </button>
                        {(!isRecording && (audioBlob || sessionTime > 0)) && (
                            <button
                                onClick={handleSaveSessionData}
                                disabled={saving}
                                className="bg-primary-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={20} />}
                                Save
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Side: Live Transcript */}
                <div className="lg:col-span-8 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm h-[600px] flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center gap-3 bg-white">
                        <FileText size={20} className="text-primary-500" />
                        <h2 className="text-lg font-black text-slate-800">Live Transcript</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-white">
                        {transcript.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                                <Mic size={48} className="mb-4 text-slate-400" />
                                <p className="text-lg font-bold text-slate-400 uppercase tracking-widest">Awaiting Session Initiation</p>
                            </div>
                        ) : (
                            transcript.map((entry, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0 pt-1 w-16">
                                        {formatTime(entry.time)}
                                    </span>
                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <span className="text-xs font-black uppercase tracking-widest text-[#2563eb] mb-1">
                                            {entry.speaker}
                                        </span>
                                        <p className="text-slate-600 font-medium leading-relaxed">
                                            {entry.text}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Side: Flags & Quick Notes */}
                <div className="lg:col-span-4 space-y-8">

                    {/* Flags Section */}
                    <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-8">
                        <div className="flex items-center gap-3 mb-6 text-[#ef4444]">
                            <Tag size={20} className="transform -rotate-90" />
                            <h2 className="text-lg font-black text-slate-800">Flag Clinical Themes</h2>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            {predefinedThemes.map((theme) => {
                                const isSelected = clinicalThemes.includes(theme);
                                return (
                                    <button
                                        key={theme}
                                        onClick={() => toggleTheme(theme)}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-sm font-bold border transition-all",
                                            isSelected
                                                ? "bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-200"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
                                        )}
                                    >
                                        {theme}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quick Notes Section */}
                    <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-8 flex flex-col h-[300px]">
                        <h2 className="text-lg font-black text-slate-800 mb-6">Quick Notes</h2>
                        <textarea
                            value={quickNotes}
                            onChange={(e) => setQuickNotes(e.target.value)}
                            placeholder="Jot down observations..."
                            className="flex-1 w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none placeholder:text-slate-400"
                        />
                    </div>

                </div>
            </div>
        </div>
    );
}
