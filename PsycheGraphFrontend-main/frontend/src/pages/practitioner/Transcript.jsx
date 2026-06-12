import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchSessions, fetchTranscript } from '../../store/slices/SessionSlice';
import {
    User,
    Calendar,
    FileText,
    Mic,
    Loader2,
    ChevronDown,
    Search
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function Transcript() {
    const dispatch = useDispatch();
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: sessions, loading: sessionsLoading } = useSelector((state) => state.sessions);

    // Selection state
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [transcript, setTranscript] = useState([]);
    const [loadingTranscript, setLoadingTranscript] = useState(false);

    // Filter patients
    const [searchTerm, setSearchTerm] = useState('');
    const filteredPatients = patients.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        dispatch(fetchPatients());
    }, [dispatch]);

    useEffect(() => {
        if (selectedPatientId) {
            dispatch(fetchSessions(selectedPatientId));
            setSelectedSessionId('');
            setTranscript([]);
        }
    }, [selectedPatientId, dispatch]);

    const handleSessionSelect = async (sessionId) => {
        setSelectedSessionId(sessionId);
        const session = sessions.find(s => String(s.id) === String(sessionId));

        if (session && session.appointment_id) {
            setLoadingTranscript(true);
            try {
                const data = await dispatch(fetchTranscript(session.appointment_id)).unwrap();
                if (data && Array.isArray(data)) {
                    setTranscript(data);
                } else if (data && typeof data === 'object' && data.transcript) {
                    setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
                }
            } catch (err) {
                console.error('Failed to fetch transcript:', err);
                setTranscript([]);
            } finally {
                setLoadingTranscript(false);
            }
        } else {
            setTranscript([]);
        }
    };

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '00:00:00';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col p-8 overflow-y-auto">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1 font-inter">Clinical Transcripts</h1>
                <p className="text-slate-500 font-medium font-inter">Review and analyze past session conversations</p>
            </div>

            {/* Selection Bar */}
            <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 mb-8 flex flex-col lg:flex-row items-center gap-8">
                <div className="w-full lg:w-96 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <User size={14} className="text-primary-600" />
                        <label className="text-xs font-bold text-slate-700">Patient <span className="text-rose-500">*</span></label>
                    </div>
                    <div className="relative group">
                        <select
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value)}
                            className="w-full h-14 pl-5 pr-10 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-slate-600 font-medium focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/30 focus:bg-white outline-none transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[position:right_1.25rem_center]"
                        >
                            <option value="">Select patient</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="w-full lg:w-96 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Calendar size={14} className="text-primary-600" />
                        <label className="text-xs font-bold text-slate-700">Appointment <span className="text-slate-400 font-normal">(optional)</span></label>
                    </div>
                    <div className="relative group">
                        <select
                            value={selectedSessionId}
                            onChange={(e) => handleSessionSelect(e.target.value)}
                            disabled={!selectedPatientId}
                            className="w-full h-14 pl-5 pr-10 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-slate-600 font-medium focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500/30 focus:bg-white outline-none transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[position:right_1.25rem_center] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">{selectedPatientId ? 'Select appointment' : 'Select Patient first'}</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>
                                    #{s.appointment_id || s.id} — {s.status || 'SCHEDULED'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {sessionsLoading && <Loader2 className="animate-spin text-primary-500" size={24} />}
            </div>

            {/* Transcript View - Reusing premium styles from SessionMode */}
            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[600px]">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <FileText size={20} className="text-primary-500" />
                        <h2 className="text-lg font-black text-slate-800">Transcript Content</h2>
                    </div>
                    {selectedSessionId && (
                        <div className="px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary-100">
                            Saved Content
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-white">
                    {!selectedSessionId ? (
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
                                const sess = sessions.find(s => String(s.id) === String(selectedSessionId));
                                const soap = sess?.soap_notes || {};
                                const fields = [
                                    { key: 'subjective', label: 'Subjective', letter: 'S' },
                                    { key: 'objective', label: 'Objective', letter: 'O' },
                                    { key: 'assessment', label: 'Assessment', letter: 'A' },
                                    { key: 'plan', label: 'Plan', letter: 'P' },
                                ];

                                return (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12 border-b border-slate-50">
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
                                ) : (
                                    transcript.map((entry, idx) => (
                                        <div key={idx} className="flex gap-4 group">
                                            <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0 pt-1 w-16 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatTime(entry.time)}
                                            </span>
                                            <div className="flex flex-col gap-1.5 flex-1">
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-[0.15em] mb-1",
                                                    entry.speaker === 'Practitioner' ? "text-[#2563eb]" : "text-[#10b981]"
                                                )}>
                                                    {entry.speaker}
                                                </span>
                                                <p className="text-slate-600 font-medium leading-relaxed max-w-3xl">
                                                    {entry.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
