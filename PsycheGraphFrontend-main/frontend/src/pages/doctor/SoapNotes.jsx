import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronRight,
    Save,
    CheckCircle2,
    FileText,
    Loader2,
    AlertCircle,
    Calendar,
    User,
    Clipboard,
    RefreshCw,
    X,
    Pencil
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { createSoapNote, fetchSessions, updateSession } from '../../store/slices/SessionSlice';

const cn = (...inputs) => twMerge(clsx(inputs));

const EMPTY_NOTES = { subjective: '', objective: '', assessment: '', plan: '', conversation: '' };
const EMPTY_TREATMENT_PLAN = '';

export default function SoapNotes() {
    const dispatch = useDispatch();
    const { list: patients } = useSelector((state) => state.patients);
    const { list: appointments } = useSelector((state) => state.appointments);
    const { list: sessions, loading: sessionLoading, error: sessionError } = useSelector((state) => state.sessions);
    const user = useSelector((state) => state.auth?.user || state.login?.user);

    const [activeTab, setActiveTab] = useState('Create / Edit');
    const [patientId, setPatientId] = useState('');
    const [appointmentId, setAppointmentId] = useState('');
    const [notes, setNotes] = useState(EMPTY_NOTES);
    const [treatmentPlan, setTreatmentPlan] = useState(EMPTY_TREATMENT_PLAN);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editNotes, setEditNotes] = useState(EMPTY_NOTES);
    const [editTreatmentPlan, setEditTreatmentPlan] = useState(EMPTY_TREATMENT_PLAN);
    const [isUpdating, setIsUpdating] = useState(false);

    // Resolve doctor id from logged-in user
    const doctorId = user?.id || user?.user?.id || user?.doctor_id || '';

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
        dispatch(fetchSessions());
    }, [dispatch]);

    // Filter appointments for selected patient
    const patientAppointments = appointments.filter(
        (a) => patientId && String(a.patient_id) === String(patientId)
    );

    const handleNoteChange = (field, value) => {
        setNotes((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setErrorMsg('');
        if (!patientId) { setErrorMsg('Please select a patient.'); return; }
        if (!doctorId) { setErrorMsg('Practitioner ID not found. Please re-login.'); return; }

        setIsSaving(true);
        try {
            await dispatch(createSoapNote({
                patient_id: Number(patientId),
                doctor_id: Number(doctorId),
                appointment_id: appointmentId ? Number(appointmentId) : 0,
                soap_notes: {
                    subjective: notes.subjective,
                    objective: notes.objective,
                    assessment: notes.assessment,
                    plan: notes.plan,
                    conversation: notes.conversation,
                },
                treatment_plan: treatmentPlan
            })).unwrap();

            setShowSuccess(true);
            setNotes(EMPTY_NOTES);
            setTreatmentPlan(EMPTY_TREATMENT_PLAN);
            setPatientId('');
            setAppointmentId('');
            dispatch(fetchSessions()); // refresh All Notes
            setTimeout(() => setShowSuccess(false), 3500);
        } catch (err) {
            setErrorMsg(typeof err === 'string' ? err : 'Failed to save SOAP note. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const noteFields = [
        { key: 'subjective', label: 'Subjective', letter: 'S', placeholder: "Patient's reported symptoms, feelings, concerns..." },
        { key: 'objective', label: 'Objective', letter: 'O', placeholder: 'Clinical observations, mental status exam, behavioral notes...' },
        { key: 'assessment', label: 'Assessment', letter: 'A', placeholder: 'Clinical interpretation, progress evaluation...' },
        { key: 'plan', label: 'Plan', letter: 'P', placeholder: 'Treatment steps, follow-ups, medication notes, referrals...' },
        { key: 'conversation', label: 'Conversation', letter: 'C', placeholder: 'Clinical conversation notes or transcript summary...' },
    ];

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20 pt-4 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">SOAP Notes</h1>
                <p className="text-slate-500 font-medium text-sm sm:text-base">Create and manage structured clinical notes</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                {['Create / Edit', 'All Notes'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'px-4 py-2 text-sm font-bold rounded-lg transition-all',
                            activeTab === tab
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium"
                    >
                        <CheckCircle2 size={18} className="shrink-0" />
                        SOAP note saved successfully!
                    </motion.div>
                )}
                {errorMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium"
                    >
                        <AlertCircle size={18} className="shrink-0" />
                        {errorMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            {activeTab === 'Create / Edit' ? (
                <div className="bg-white p-6 space-y-8">

                    {/* Patient & Appointment Selectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Patient */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <User size={13} className="text-indigo-500" /> Patient <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={patientId}
                                    onChange={(e) => { setPatientId(e.target.value); setAppointmentId(''); }}
                                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 appearance-none font-medium cursor-pointer"
                                >
                                    <option value="" disabled>Select patient</option>
                                    {patients.filter(p => p.is_active === true).map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.full_name || p.name || `Patient #${p.id}`}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Appointment */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Calendar size={13} className="text-indigo-500" /> Appointment <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={appointmentId}
                                    onChange={(e) => setAppointmentId(e.target.value)}
                                    disabled={!patientId}
                                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 appearance-none font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Select appointment</option>
                                    {patientAppointments.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.date || a.appointment_date || `#${a.id}`} — {a.status || 'Scheduled'}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SOAP Fields */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {noteFields.map(({ key, label, letter, placeholder }) => (
                            <div key={key} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm">{letter}</div>
                                    <label className="text-sm font-bold text-slate-800">{label}</label>
                                </div>
                                <textarea
                                    value={notes[key]}
                                    onChange={(e) => handleNoteChange(key, e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[140px] resize-y placeholder:text-slate-400"
                                />
                            </div>
                        ))}

                        {/* Treatment Plan Field Integrated in Grid */}
                        <div className="space-y-3 lg:col-span-2 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-md bg-cyan-600 text-white flex items-center justify-center text-xs font-black shadow-sm">T</div>
                                <label className="text-sm font-bold text-slate-800">Treatment Plan</label>
                            </div>
                            <textarea
                                value={treatmentPlan}
                                onChange={(e) => setTreatmentPlan(e.target.value)}
                                placeholder="Long-term treatment strategies and clinical goals..."
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[120px] resize-y placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-600/20"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {isSaving ? 'Saving...' : 'Save SOAP Note'}
                        </button>
                        <button
                            onClick={() => { 
                                setNotes(EMPTY_NOTES); 
                                setTreatmentPlan(EMPTY_TREATMENT_PLAN);
                                setPatientId(''); 
                                setAppointmentId(''); 
                                setErrorMsg(''); 
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm"
                        >
                            <Save size={16} className="text-slate-400" /> Clear Form
                        </button>
                    </div>
                </div>
            ) : (
                /* All Notes Tab */
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800">All SOAP Notes</h3>
                        <button
                            onClick={() => dispatch(fetchSessions())}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                            <RefreshCw size={13} /> Refresh
                        </button>
                    </div>
                    {sessionLoading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400">
                            <Loader2 size={28} className="animate-spin" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                            <FileText size={40} className="opacity-30" />
                            <p className="text-sm font-medium">No SOAP notes found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {sessions.map((s) => {
                                const soap = s.soap_notes || {};
                                const patName = patients.find(p => String(p.id) === String(s.patient_id))?.full_name || `Patient #${s.patient_id}`;
                                const isExpanded = selectedNoteId === s.id;
                                return (
                                    <div key={s.id} className="transition-colors">
                                        <div
                                            onClick={() => setSelectedNoteId(isExpanded ? null : s.id)}
                                            className={cn(
                                                "px-6 py-4 cursor-pointer transition-all hover:bg-slate-50",
                                                isExpanded && "bg-indigo-50/50 border-l-4 border-indigo-500"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <ChevronRight
                                                            size={14}
                                                            className={cn(
                                                                "text-slate-400 transition-transform duration-200 shrink-0",
                                                                isExpanded && "rotate-90 text-indigo-500"
                                                            )}
                                                        />
                                                        <span className="text-sm font-bold text-slate-800">{patName}</span>
                                                        {s.appointment_id && (
                                                            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                                                Appt #{s.appointment_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!isExpanded && soap.subjective && <p className="text-xs text-slate-500 truncate pl-[22px]"><span className="font-semibold text-slate-600">S:</span> {soap.subjective}</p>}
                                                    {!isExpanded && soap.plan && <p className="text-xs text-slate-500 truncate pl-[22px]"><span className="font-semibold text-slate-600">P:</span> {soap.plan}</p>}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0">
                                                    <Clipboard size={12} />
                                                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Detail Panel */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-6 pb-5 pt-2 bg-slate-50/80 border-l-4 border-indigo-500">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Full SOAP Note</h4>
                                                            <div className="flex items-center gap-2">
                                                                {editingNoteId !== s.id && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingNoteId(s.id);
                                                                            setEditNotes({
                                                                                subjective: soap.subjective || '',
                                                                                objective: soap.objective || '',
                                                                                assessment: soap.assessment || '',
                                                                                plan: soap.plan || '',
                                                                                conversation: soap.conversation || '',
                                                                            });
                                                                            setEditTreatmentPlan(s.treatment_plan || '');
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors"
                                                                    >
                                                                        <Pencil size={12} />
                                                                        Edit
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedNoteId(null); setEditingNoteId(null); }}
                                                                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {[
                                                                { key: 'subjective', label: 'Subjective', letter: 'S', color: 'bg-blue-600' },
                                                                { key: 'objective', label: 'Objective', letter: 'O', color: 'bg-emerald-600' },
                                                                { key: 'assessment', label: 'Assessment', letter: 'A', color: 'bg-amber-600' },
                                                                { key: 'plan', label: 'Plan', letter: 'P', color: 'bg-purple-600' },
                                                                { key: 'conversation', label: 'Conversation', letter: 'C', color: 'bg-violet-600' },
                                                            ].map(({ key, label, letter, color }) => (
                                                                <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className={cn("h-5 w-5 rounded text-white flex items-center justify-center text-[10px] font-black", color)}>
                                                                            {letter}
                                                                        </div>
                                                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</span>
                                                                    </div>
                                                                    {editingNoteId === s.id ? (
                                                                        <textarea
                                                                            value={editNotes[key]}
                                                                            onChange={(e) => setEditNotes(prev => ({ ...prev, [key]: e.target.value }))}
                                                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[80px] resize-y placeholder:text-slate-400"
                                                                            placeholder={`Enter ${label.toLowerCase()}...`}
                                                                        />
                                                                    ) : (
                                                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                                            {soap[key] || <span className="text-slate-400 italic">Not documented</span>}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="h-5 w-5 rounded text-white flex items-center justify-center text-[10px] font-black bg-cyan-600">
                                                                    T
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Treatment Plan</span>
                                                            </div>
                                                            {editingNoteId === s.id ? (
                                                                <textarea
                                                                    value={editTreatmentPlan}
                                                                    onChange={(e) => setEditTreatmentPlan(e.target.value)}
                                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[100px] resize-y placeholder:text-slate-400"
                                                                    placeholder="Enter treatment plan..."
                                                                />
                                                            ) : (
                                                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                                    {s.treatment_plan || <span className="text-slate-400 italic">Not documented</span>}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {/* Save / Cancel buttons for edit mode */}
                                                        {editingNoteId === s.id && (
                                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200">
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        setIsUpdating(true);
                                                                            try {
                                                                                await dispatch(updateSession({
                                                                                    id: s.id,
                                                                                    data: { 
                                                                                        soap_notes: editNotes,
                                                                                        treatment_plan: editTreatmentPlan
                                                                                    }
                                                                                })).unwrap();
                                                                                setEditingNoteId(null);
                                                                                dispatch(fetchSessions());
                                                                            } catch (err) {
                                                                            setErrorMsg(typeof err === 'string' ? err : 'Failed to update SOAP note.');
                                                                        } finally {
                                                                            setIsUpdating(false);
                                                                        }
                                                                    }}
                                                                    disabled={isUpdating}
                                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                                >
                                                                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingNoteId(null); }}
                                                                    disabled={isUpdating}
                                                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
