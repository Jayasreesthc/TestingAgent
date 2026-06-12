import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { updateSession, fetchSessions } from '../store/slices/SessionSlice';
import { fetchPatients } from '../store/slices/PatientSlice';
import { fetchAppointments } from '../store/slices/AppointmentSlice';
import { FileAudio, ClipboardList, Save, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SessionDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: sessions, loading: sessionsLoading } = useSelector((state) => state.sessions);
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments } = useSelector((state) => state.appointments);

    const session = sessions.find(s => s.id === parseInt(id));
    const patient = session ? patients.find(p => p.id === session.patient_id) : null;
    const appointment = session?.appointment_id ? appointments.find(a => String(a.id) === String(session.appointment_id)) : null;

    const [soapNote, setSoapNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!sessions.length) {
            dispatch(fetchSessions());
        }
        if (!patients.length) {
            dispatch(fetchPatients());
        }
        if (!appointments.length) {
            dispatch(fetchAppointments());
        }
        if (session) {
            setSoapNote(session.soap_note || '');
        }
    }, [dispatch, session, sessions.length, patients.length, appointments.length]);

    const handleSave = async () => {
        setIsSaving(true);
        setSuccess(false);
        try {
            await dispatch(updateSession({ id: session.id, data: { soap_note: soapNote } })).unwrap();
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save SOAP note:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && !session) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="text-center p-12">
                <AlertCircle className="mx-auto text-slate-400 mb-4" size={48} />
                <h2 className="text-xl font-bold text-slate-900">Session not found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 font-semibold">Go Back</button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Back</span>
                </button>
                <div className="flex items-center gap-4">
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 animate-in fade-in slide-in-from-right-4">
                            <CheckCircle2 size={16} />
                            <span>Changes Saved</span>
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        <span>Save SOAP Note</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Info & Audio */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-primary-50 text-primary-600 p-3 rounded-xl">
                                <FileAudio size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Session Info</h3>
                                <p className="text-xs text-slate-500">ID: #{session.id}</p>
                            </div>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500">Patient</span>
                                <span className="text-slate-900 font-bold">{patient?.full_name || 'Loading...'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500">Date</span>
                                <span className="text-slate-900 font-semibold">
                                    {new Date(session.date).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500">Time</span>
                                <span className="text-slate-900 font-semibold">
                                    {appointment?.start_time
                                        ? new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : session?.date
                                            ? new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : '--:--'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500">Duration</span>
                                <span className="text-slate-900 font-semibold">--:--</span>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Recording</label>
                            <audio
                                controls
                                className="w-full h-12"
                                src={`/api/${session.audio_url}`}
                            >
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    </div>
                </div>

                {/* Right Column: Transcript & Notes */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                            <ClipboardList size={18} className="text-slate-500" />
                            <h3 className="font-bold text-slate-700 text-sm">Clinical Summary & SOAP Note</h3>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={soapNote}
                                onChange={(e) => setSoapNote(e.target.value)}
                                className="w-full h-[400px] bg-slate-50/50 p-4 rounded-xl border border-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-slate-800 leading-relaxed transition-all resize-none"
                                placeholder="Start typing your clinical notes here..."
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                            <FileAudio size={18} className="text-slate-500" />
                            <h3 className="font-bold text-slate-700 text-sm">Automated Transcript</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 leading-relaxed font-medium">
                                {session.transcript || 'No transcript available for this session.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
