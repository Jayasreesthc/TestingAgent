import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Users, FileAudio, ClipboardList, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchPatients } from '../store/slices/PatientSlice';
import { fetchSessions } from '../store/slices/SessionSlice';

export default function Dashboard() {
    const dispatch = useDispatch();
    const { list: patients } = useSelector((state) => state.patients);
    const { list: sessions } = useSelector((state) => state.sessions);

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchSessions());
    }, [dispatch]);

    const stats = [
        { label: 'Total Patients', value: patients.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Total Sessions', value: sessions.length, icon: FileAudio, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'SOAP Notes', value: sessions.filter(s => s.soap_note).length, icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];


    
    return (
        <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4">
                            <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                                <stat.icon size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Patients */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">Recent Patients</h2>
                        <Link to="/patients" className="text-primary-600 text-sm font-semibold hover:text-primary-700 transition-colors">
                            View All
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {patients.slice(0, 5).map((patient) => (
                            <div key={patient.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                        {patient.full_name[0]}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">{patient.full_name}</p>
                                        <p className="text-xs text-slate-500">{patient.contact_number}</p>
                                    </div>
                                </div>
                                <button className="text-slate-400 hover:text-slate-600">
                                    <Plus size={20} />
                                </button>
                            </div>
                        ))}
                        {patients.length === 0 && (
                            <div className="p-8 text-center text-slate-500 italic">No patients found.</div>
                        )}
                    </div>
                </div>

                {/* Recent Sessions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900">Recent Sessions</h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {sessions.slice(0, 5).map((session) => (
                            <Link
                                key={session.id}
                                to={`/sessions/${session.id}`}
                                className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group"
                            >
                                <div className="bg-primary-50 text-primary-600 p-2 rounded-lg group-hover:bg-primary-600 group-hover:text-white transition-all">
                                    <FileAudio size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-900">Session #{session.id}</p>
                                    <p className="text-xs text-slate-500">{new Date(session.date).toLocaleDateString()}</p>
                                </div>
                                <ArrowRight className="text-slate-300 group-hover:text-primary-600" size={16} />
                            </Link>
                        ))}
                        {sessions.length === 0 && (
                            <div className="p-8 text-center text-slate-500 italic">No sessions recorded yet.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
