import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    FileAudio, 
    Search, 
    Building2, 
    User, 
    Stethoscope, 
    Play, 
    Pause, 
    Loader2, 
    Calendar,
    ChevronDown,
    Activity,
    Clock,
    UserCheck,
    Volume2,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchOrganizations } from '../../store/slices/OrgSlice';
import { fetchAudioRecordings } from '../../store/slices/SessionSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function AudioRecords() {
    const dispatch = useDispatch();
    const { list: organizations } = useSelector((state) => state.organizations);
    const { audioRecordings, loading: recordingsLoading } = useSelector((state) => state.sessions);
    const { list: allUsers } = useSelector((state) => state.users);
    const { list: allPatients } = useSelector((state) => state.patients);

    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Playback state
    const [playingId, setPlayingId] = useState(null);
    const [playbackError, setPlaybackError] = useState(null);

    useEffect(() => {
        dispatch(fetchOrganizations());
        dispatch(fetchUsers());
        dispatch(fetchPatients());
    }, [dispatch]);

    useEffect(() => {
        if (selectedOrgId) {
            dispatch(fetchAudioRecordings({ 
                organization_id: selectedOrgId,
                doctor_id: selectedDoctorId || undefined,
                patient_id: selectedPatientId || undefined
            }));
        }
    }, [selectedOrgId, selectedDoctorId, selectedPatientId, dispatch]);

    // Helper to get correct audio URL
    const getAudioUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        // Prefix with /api/ for relative paths as seen in SessionDetails.jsx
        return `/api/${url.startsWith('/') ? url.slice(1) : url}`;
    };

    const handlePlayPause = (record) => {
        const audio = document.getElementById('global-audio-player');
        if (!audio) return;

        if (playingId === record.id) {
            audio.pause();
            setPlayingId(null);
        } else {
            setPlaybackError(null);
            const url = getAudioUrl(record.audio_url);
            audio.src = url;
            audio.load();
            audio.play().catch(err => {
                console.error("Playback failed:", err);
                setPlaybackError("Audio format not supported or access denied (CORS).");
            });
            setPlayingId(record.id);
        }
    };

    // Filtered lists for dropdowns
    const orgDoctors = allUsers.filter(u => String(u.organization_id) === String(selectedOrgId) && u.role?.toUpperCase() === 'DOCTOR');
    const orgPatients = allPatients.filter(p => String(p.organization_id) === String(selectedOrgId));

    // Internal filtering for the records table
    const filteredRecordings = audioRecordings.filter(rec => {
        const patientSpec = allPatients.find(p => String(p.id) === String(rec.patient_id));
        const doctorSpec = allUsers.find(u => String(u.id) === String(rec.doctor_id));
        
        const searchStr = searchTerm.toLowerCase();
        if (!searchStr) return true;

        return (
            (patientSpec?.full_name || '').toLowerCase().includes(searchStr) ||
            (doctorSpec?.full_name || '').toLowerCase().includes(searchStr) ||
            (rec.session_date || '').toLowerCase().includes(searchStr) ||
            String(rec.patient_id).includes(searchStr) ||
            String(rec.doctor_id).includes(searchStr)
        );
    });

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            {/* Hidden Audio Player */}
            <audio 
                id="global-audio-player" 
                className="hidden" 
                onEnded={() => setPlayingId(null)}
                onError={() => {
                    setPlaybackError("Failed to load audio stream.");
                    setPlayingId(null);
                }}
            />

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <FileAudio className="text-primary-600" size={32} />
                        Audio Records
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Review and audit clinical session recordings across organizations</p>
                </div>
            </div>

            {/* Selection Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hospital / Organization</label>
                    <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <select
                            value={selectedOrgId}
                            onChange={(e) => {
                                setSelectedOrgId(e.target.value);
                                setSelectedDoctorId('');
                                setSelectedPatientId('');
                            }}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Select Organization</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Practitioner</label>
                    <div className="relative group">
                        <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            disabled={!selectedOrgId}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">All Practitioners</option>
                            {orgDoctors.map(doc => (
                                <option key={doc.id} value={doc.id}>{doc.full_name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient</label>
                    <div className="relative group">
                        <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <select
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value)}
                            disabled={!selectedOrgId}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">All Patients</option>
                            {orgPatients.map(pat => (
                                <option key={pat.id} value={pat.id}>{pat.full_name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global Search</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find by name or date..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={!selectedOrgId}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-sm outline-none disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            {/* Recordings Collection */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col">
                {!selectedOrgId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 border border-slate-100 shadow-inner">
                            <Building2 size={48} />
                        </div>
                        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Select an Organization</h3>
                        <p className="text-slate-300 font-medium max-w-sm mt-2">Please choose a hospital or organization from the dropdown above to view its audio recordings.</p>
                    </div>
                ) : recordingsLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-20">
                        <div className="relative">
                            <Loader2 className="animate-spin text-primary-600" size={48} />
                            <Volume2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-300" size={20} />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-primary-600 uppercase tracking-[0.3em]">Synchronizing Streams</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest animate-pulse">Loading Metadata...</p>
                        </div>
                    </div>
                ) : filteredRecordings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 border border-slate-100 shadow-inner">
                            <Activity size={48} />
                        </div>
                        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">No Audio Found</h3>
                        <p className="text-slate-300 font-medium max-w-sm mt-2">There are no recorded sessions matching the selected filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Details</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Practitioner</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Version</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <AnimatePresence mode="popLayout">
                                    {filteredRecordings.map((record) => {
                                        const p = allPatients.find(pat => String(pat.id) === String(record.patient_id));
                                        const d = allUsers.find(u => String(u.id) === String(record.doctor_id));
                                        
                                        return (
                                            <motion.tr 
                                                key={record.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="group hover:bg-primary-50/30 transition-all duration-300"
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-primary-600 font-black group-hover:scale-110 transition-transform flex-shrink-0">
                                                            {(p?.full_name || 'P')[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-slate-900 leading-none truncate">{p?.full_name || 'Patient record not cached'}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">Patient #{record.patient_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                                            <Stethoscope size={14} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-700 truncate">{d?.full_name || 'Practitioner'}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium truncate">ID: {record.doctor_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                            <Calendar size={14} className="text-slate-400" />
                                                            {new Date(record.session_date).toLocaleDateString()}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            <Clock size={12} />
                                                            {new Date(record.session_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100">
                                                        v{record.version_number || 1}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button 
                                                        onClick={() => handlePlayPause(record)}
                                                        className={cn(
                                                            "p-4 rounded-2xl transition-all shadow-lg active:scale-95 group/btn",
                                                            playingId === record.id 
                                                                ? "bg-rose-500 text-white shadow-rose-200" 
                                                                : "bg-primary-600 text-white shadow-primary-200 hover:bg-primary-700"
                                                        )}
                                                    >
                                                        {playingId === record.id ? (
                                                            <div className="flex items-center gap-2 pr-1">
                                                                <Pause size={20} fill="currentColor" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Stop Review</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 pr-1">
                                                                <Play size={20} fill="currentColor" className="translate-x-0.5" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Play Record</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {/* Playback Toast */}
            <AnimatePresence>
                {playingId && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-primary-500 rounded-2xl flex items-center justify-center animate-pulse flex-shrink-0">
                                <Volume2 size={20} />
                            </div>
                            <div className="min-w-0 max-w-[200px]">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] leading-none mb-1.5">Now Reviewing Session</p>
                                <p className="text-sm font-bold text-white tracking-tight leading-none truncate">
                                    {(() => {
                                        const rec = audioRecordings.find(r => r.id === playingId);
                                        const p = allPatients.find(p => String(p.id) === String(rec?.patient_id));
                                        return p?.full_name || `Patient #${rec?.patient_id || ''}`;
                                    })()}
                                </p>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-white/10" />

                        <div className="flex flex-col gap-1 min-w-[150px]">
                            {playbackError ? (
                                <div className="flex items-center gap-2 text-rose-400 text-[10px] font-bold">
                                    <AlertCircle size={12} />
                                    <span>Error Loading Audio</span>
                                </div>
                            ) : (
                                <div className="flex gap-1 items-center justify-center">
                                    {[1, 2, 3, 4, 3, 2, 4, 1, 3, 2].map((h, i) => (
                                        <motion.div 
                                            key={i}
                                            animate={{ height: [`${h*3}px`, `${h*6}px`, `${h*3}px`] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                                            className="w-1 bg-primary-400 rounded-full"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => {
                                const audio = document.getElementById('global-audio-player');
                                if (audio) audio.pause();
                                setPlayingId(null);
                            }}
                            className="bg-white/10 hover:bg-rose-500 hover:text-white p-2.5 rounded-xl transition-all"
                        >
                            <Pause size={18} fill="currentColor" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
