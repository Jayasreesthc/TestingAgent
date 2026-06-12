import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSessions } from '../store/slices/SessionSlice';
import { FileAudio, Calendar, User, ArrowRight, Loader2, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Sessions() {
    const dispatch = useDispatch();
    const { list: sessions, loading } = useSelector((state) => state.sessions);
    const { list: patients } = useSelector((state) => state.patients);

    useEffect(() => {
        dispatch(fetchSessions());
    }, [dispatch]);

    const getPatientName = (patientId) => {
        const patient = patients.find(p => p.id === patientId);
        return patient ? patient.full_name : 'Unknown Patient';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Clinical Sessions</h2>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                    {loading && sessions.length === 0 ? (
                        <div className="p-12 text-center">
                            <Loader2 className="animate-spin text-primary-600 mx-auto" size={32} />
                            <p className="text-slate-500 mt-4 font-medium">Loading sessions...</p>
                        </div>
                    ) : sessions.map((session) => (
                        <Link
                            key={session.id}
                            to={`/sessions/${session.id}`}
                            className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all group"
                        >
                            <div className="flex items-center gap-6">
                                <div className="h-12 w-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all">
                                    <FileAudio size={24} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">Session #{session.id}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                                            {session.version > 1 ? `v${session.version}` : 'Original'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} />
                                            <span>{getPatientName(session.patient_id)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} />
                                            <span>{new Date(session.date).toLocaleDateString()}</span>
                                        </div>
                                        {session.soap_note && (
                                            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                                <ClipboardList size={14} />
                                                <span>Note Ready</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Status</p>
                                    <p className="text-sm font-semibold text-slate-900">Completed</p>
                                </div>
                                <ArrowRight className="text-slate-300 group-hover:text-primary-600 transform group-hover:translate-x-1 transition-all" size={20} />
                            </div>
                        </Link>
                    ))}
                    {sessions.length === 0 && !loading && (
                        <div className="p-16 text-center">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileAudio size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">No sessions yet</h3>
                            <p className="text-slate-500 mt-1 max-w-xs mx-auto text-sm">
                                Start recording sessions from the patient profiles to see them here.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
