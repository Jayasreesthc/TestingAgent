import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, deletePatient } from '../../store/slices/PatientSlice';
import { fetchAppointments, rescheduleAppointment, createAvailability, fetchUpdatedAppointments, fetchAvailability, createAppointment, deleteAppointment } from '../../store/slices/AppointmentSlice';
import { createSoapNote, fetchSessions, updateSession } from '../../store/slices/SessionSlice';
import { fetchPractitionerFee, clearPractitionerFee } from '../../store/slices/AllUserSlice';
import { Search, PlayCircle, Trash2, FileText, Database, ChevronLeft, ChevronRight, Edit3, X, Eye, Video, Trash, Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, User, Stethoscope, MapPin, Wallet, Building, Edit2, RefreshCcw, Mic, MicOff, Send, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function TimeSlotButton({ slot, selectedSlotId, onClick }) {
    const isSelected = String(selectedSlotId) === String(slot.id);
    const isBooked = slot.isBooked;
    return (
        <button
            type="button"
            onClick={() => !isBooked && onClick(slot)}
            disabled={isBooked}
            className={cn(
                "px-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all relative overflow-hidden flex items-center justify-center",
                isBooked
                    ? "bg-slate-100/60 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                    : isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105 z-10"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
            )}
            title={isBooked ? "Slot Already Booked" : ""}
        >
            <span className={isBooked ? "opacity-40 line-through decoration-slate-400" : ""}>{slot.time}</span>
        </button>
    );
}

export default function PractitionerPatients() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments, availability, loading: appointmentsLoading } = useSelector((state) => state.appointments);
    const { list: sessions } = useSelector((state) => state.sessions);
    const { practitionerFee } = useSelector((state) => state.users);
    const { user: authUser } = useSelector((state) => state.auth);
    const practitionerId = authUser?.id || authUser?.user?.id || authUser?.practitioner_id || '';

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [statusFilter, setStatusFilter] = useState('All Status'); // 'All Status', 'SCHEDULED', 'RESCHEDULED', 'DISCHARGED'

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [availableDates, setAvailableDates] = useState([]);

    // Reschedule Modal State (Matches Receptionist Style)
    const [rescheduleModal, setRescheduleModal] = useState({
        isOpen: false,
        appointmentId: null,
        practitionerId: null,
        patientId: null,
        date: '',
        time: '',
        availability_id: '',
        booking_type: 'offline',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // SOAP Modal State
    const [soapModal, setSoapModal] = useState({
        isOpen: false,
        appointment: null,
        notes: { subjective: '', objective: '', assessment: '', plan: '', conversation: '' },
        activeField: 'conversation',
        sessionId: null
    });
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [isSavingSoap, setIsSavingSoap] = useState(false);
    const [soapSuccess, setSoapSuccess] = useState(false);
    const [soapError, setSoapError] = useState('');

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                setSoapModal(prev => ({
                    ...prev,
                    notes: {
                        ...prev.notes,
                        conversation: prev.notes.conversation + (prev.notes.conversation ? ' ' : '') + finalTranscript
                    }
                }));
            }
        };

        recog.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsTranscribing(false);
        };

        recog.onend = () => {
            setIsTranscribing(false);
        };

        setRecognition(recog);
    }, []);

    const toggleTranscription = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
            return;
        }

        if (isTranscribing) {
            recognition.stop();
        } else {
            recognition.start();
            setIsTranscribing(true);
        }
    };

    const openSoapModal = (app) => {
        // Find if a session with existing SOAP notes already exists for this appointment
        const existingSession = sessions.find(s => String(s.appointment_id) === String(app.id));
        const existingNotes = existingSession?.soap_notes || { subjective: '', objective: '', assessment: '', plan: '', conversation: '' };

        setSoapModal({
            isOpen: true,
            appointment: app,
            notes: { conversation: '', ...existingNotes },
            activeField: 'conversation',
            sessionId: existingSession?.id || null
        });
        setSoapError('');
        setSoapSuccess(false);
    };

    const handleSoapSubmit = async () => {
        if (!soapModal.appointment) return;
        setIsSavingSoap(true);
        setSoapError('');

        try {
            if (soapModal.sessionId) {
                // Update existing session
                await dispatch(updateSession({
                    id: soapModal.sessionId,
                    data: {
                        soap_notes: soapModal.notes,
                        // Maintain other session fields if necessary, though PUT usually likes full objects
                        // But per user's screenshot, it accepts a partial/full body
                        patient_id: Number(soapModal.appointment.patient_id),
                        practitioner_id: Number(practitionerId),
                        appointment_id: Number(soapModal.appointment.id),
                    }
                })).unwrap();
            } else {
                // Create new session with SOAP notes
                await dispatch(createSoapNote({
                    patient_id: Number(soapModal.appointment.patient_id),
                    practitioner_id: Number(practitionerId),
                    appointment_id: Number(soapModal.appointment.id),
                    soap_notes: soapModal.notes
                })).unwrap();
            }

            setSoapSuccess(true);
            setTimeout(() => {
                setSoapModal(prev => ({ ...prev, isOpen: false }));
                setSoapSuccess(false);
            }, 2000);
            dispatch(fetchSessions());
        } catch (err) {
            setSoapError(err || 'Failed to save SOAP note');
        } finally {
            setIsSavingSoap(false);
        }
    };

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
        dispatch(fetchSessions());
    }, [dispatch]);

    // Generate available dates (30 days)
    useEffect(() => {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const localDateStr = d.toISOString().split('T')[0];
            dates.push({
                dateObj: d,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: d.getDate(),
                fullDate: localDateStr,
                month: d.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        setAvailableDates(dates);
    }, []);

    // Fetch availability for rescheduling
    useEffect(() => {
        if (rescheduleModal.isOpen && rescheduleModal.practitionerId && rescheduleModal.date) {
            const orgId = authUser?.organization_id || authUser?.user?.organization_id;
            dispatch(fetchAvailability({
                practitioner_id: rescheduleModal.practitionerId,
                organization_id: orgId,
                start_date: rescheduleModal.date,
                end_date: rescheduleModal.date,
                only_available: true
            }));
        }
    }, [dispatch, rescheduleModal.isOpen, rescheduleModal.practitionerId, rescheduleModal.date, authUser]);

    // Fetch Practitioner Fee on Modal Open
    useEffect(() => {
        if (rescheduleModal.isOpen && rescheduleModal.practitionerId) {
            dispatch(fetchPractitionerFee(rescheduleModal.practitionerId));
        } else {
            dispatch(clearPractitionerFee());
        }
    }, [dispatch, rescheduleModal.isOpen, rescheduleModal.practitionerId]);

    const timeSlotsForReschedule = useMemo(() => {
        const morning = [];
        const afternoon = [];
        const evening = [];
        if (!Array.isArray(availability)) return { morning, afternoon, evening };

        availability.forEach(slot => {
            const date = new Date(slot.start_time);
            const hours = date.getHours();
            const timeStr = `${hours.toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            const slotObj = {
                time: timeStr,
                id: slot.id,
                isBooked: slot.is_booked,
                start_time: slot.start_time,
                end_time: slot.end_time
            };

            if (hours >= 5 && hours < 12) morning.push(slotObj);
            else if (hours >= 12 && hours < 17) afternoon.push(slotObj);
            else evening.push(slotObj);
        });
        return { morning, afternoon, evening };
    }, [availability]);

    // Primary Filtering Logic: Date-based appointments for the practitioner
    const filteredData = useMemo(() => {
        let data = appointments.filter(app => {
            const appDate = new Date(app.start_time).toISOString().split('T')[0];
            return appDate === selectedDate && String(app.practitioner_id) === String(practitionerId);
        });

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(app =>
                (app.patient_name || '').toLowerCase().includes(query) ||
                String(app.patient_id).includes(query)
            );
        }

        if (statusFilter !== 'All Status') {
            data = data.filter(app => app.status === statusFilter);
        }

        return data;
    }, [appointments, selectedDate, searchQuery, statusFilter, authUser]);

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDate, searchQuery, statusFilter]);

    const openRescheduleModal = (app) => {
        if (!app) return;
        const d = new Date(app.start_time);
        setRescheduleModal({
            isOpen: true,
            appointmentId: app.id,
            patientId: app.patient_id,
            practitionerId: app.practitioner_id || practitionerId,
            date: getLocalDateStr(d),
            time: '',
            availability_id: '',
            booking_type: app.booking_type || 'offline',
            notes: app.notes || ''
        });
    };

    const handleConfirmBooking = async (e) => {
        if (e) e.preventDefault();
        if (!rescheduleModal.availability_id) { alert('Please select a time slot.'); return; }

        const selectedSlot = [...timeSlotsForReschedule.morning, ...timeSlotsForReschedule.afternoon, ...timeSlotsForReschedule.evening]
            .find(s => String(s.id) === String(rescheduleModal.availability_id));

        setIsSubmitting(true);
        try {
            const bookingPayload = {
                patient_id: parseInt(rescheduleModal.patientId),
                practitioner_id: parseInt(rescheduleModal.practitionerId),
                start_time: selectedSlot?.start_time,
                end_time: selectedSlot?.end_time,
                notes: rescheduleModal.notes,
                meet_link: null,
                availability_id: parseInt(rescheduleModal.availability_id),
                booking_type: rescheduleModal.booking_type,
                fee: parseFloat(practitionerFee?.fee || 0)
            };

            await dispatch(createAppointment(bookingPayload)).unwrap();

            alert('Appointment rescheduled and re-booked successfully!');
            setRescheduleModal({ isOpen: false, appointmentId: null, date: '', time: '', availability_id: '', booking_type: 'offline', notes: '' });
            dispatch(fetchAppointments());
        } catch (error) {
            alert(`Failed: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">My Patients</h2>
                    <p className="text-slate-500 font-medium">Daily caseload and appointment management</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>

                    {/* Status Dropdown */}
                    {/* <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[position:right_1rem_center]"
                    >
                        <option value="All Status">All Status</option>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="RESCHEDULED">Rescheduled</option>
                        
                    </select> */}
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Find patient in today's list..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                        />
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
                        Total: {filteredData.length} Cases
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient Name</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Age</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Address</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Visit Time</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fee</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(app => {
                                const patient = patients.find(p => String(p.id) === String(app.patient_id));
                                const isRescheduled = app.status === 'RESCHEDULED';

                                return (
                                    <tr key={app.id} className={cn(
                                        "hover:bg-slate-50 transition-colors group",
                                        isRescheduled && "bg-amber-50/60 hover:bg-amber-100/60"
                                    )}>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-110 transition-transform">
                                                    {(app.patient_name || patient?.full_name || 'U')[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{app.patient_name || patient?.full_name || 'Unknown Patient'}</p>
                                                    {/* <p className="text-[10px] text-slate-400 font-bold uppercase">ID: #{app.patient_id}</p> */}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-bold text-slate-600">{app.patient_age !== undefined ? app.patient_age : patient?.age || '--'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-bold text-slate-600">{patient?.contact_number || '--'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-[11px] font-medium text-slate-500 max-w-[150px] truncate" title={patient?.address}>{patient?.address || '--'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                <p className="text-sm font-black text-slate-900">
                                                    {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                isRescheduled
                                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                                    : app.status === 'SCHEDULED' ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                                            )}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            {app.booking_type === 'online' ? (
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={app.meet_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={cn(
                                                            "p-2 rounded-xl border transition-all shadow-sm",
                                                            app.meet_link
                                                                ? "bg-indigo-600 text-white border-indigo-600 hover:scale-110 active:scale-95"
                                                                : "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                                        )}
                                                        title={app.meet_link ? "Join Video Call" : "Link not available"}
                                                    >
                                                        <Video size={16} />
                                                    </a>
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase">Video</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <div className="p-2 bg-slate-100 text-slate-400 rounded-xl border border-slate-200"><Eye size={16} /></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Offline</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-black text-slate-700">₹{app.fee || '0'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openSoapModal(app)}
                                                    className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                                    title="Add SOAP Notes"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openRescheduleModal(app)}
                                                    className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm"
                                                    title="Reschedule"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredData.length === 0 && !appointmentsLoading && (
                    <div className="p-20 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-slate-50 border border-slate-100 mb-6 shadow-inner">
                            <Database size={32} className="text-slate-200" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-1">No Appointments Found</h3>
                        <p className="text-sm font-medium text-slate-400">There are no sessions matching your selection for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.</p>
                    </div>
                )}

                {filteredData.length > itemsPerPage && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {Math.ceil(filteredData.length / itemsPerPage)}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronLeft size={18} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredData.length / itemsPerPage), p + 1))} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Reschedule Modal (Featured Booking Flow) */}
            <AnimatePresence>
                {rescheduleModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-lg font-bold text-slate-900">Select Date & Time</h3>
                                <button
                                    onClick={() => setRescheduleModal({ isOpen: false, appointmentId: null, date: '', time: '', availability_id: '', booking_type: 'offline', notes: '' })}
                                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6">
                                {/* Visit Type Toggle */}
                                <div className="flex p-1 rounded-xl bg-slate-100/80">
                                    <button
                                        onClick={() => setRescheduleModal(prev => ({ ...prev, booking_type: 'offline' }))}
                                        className={cn(
                                            "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                                            rescheduleModal.booking_type === 'offline'
                                                ? "bg-white text-indigo-600 shadow-md"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <Building size={16} />
                                        Hospital Visit
                                    </button>
                                    <button
                                        onClick={() => setRescheduleModal(prev => ({ ...prev, booking_type: 'online' }))}
                                        className={cn(
                                            "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                                            rescheduleModal.booking_type === 'online'
                                                ? "bg-white text-indigo-600 shadow-md"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <Video size={16} />
                                        Video Consult
                                    </button>
                                </div>

                                {/* Horizontal Date Selection */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Available Dates</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1 snap-x snap-mandatory">
                                        {availableDates.map((date, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setRescheduleModal(prev => ({ ...prev, date: date.fullDate, time: '', availability_id: '' }))}
                                                className={cn(
                                                    "flex flex-col items-center min-w-[70px] py-3 rounded-2xl border transition-all snap-start",
                                                    rescheduleModal.date === date.fullDate
                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg ring-4 ring-indigo-500/10"
                                                        : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200"
                                                )}
                                            >
                                                <span className="text-[10px] font-bold uppercase opacity-60 mb-1">{date.dayName}</span>
                                                <span className="text-lg font-black">{date.dayNumber}</span>
                                                <span className="text-[10px] font-bold uppercase opacity-60 mt-1">{date.month}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Categorized Time Slots */}
                                <div className="space-y-6">
                                    {Object.entries(timeSlotsForReschedule).map(([period, slots]) => (
                                        slots.length > 0 && (
                                            <div key={period} className="space-y-3">
                                                <div className="flex items-center gap-2 pl-1">
                                                    {period === 'morning' && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                                                    {period === 'afternoon' && <div className="w-1 h-1 rounded-full bg-blue-400" />}
                                                    {period === 'evening' && <div className="w-1 h-1 rounded-full bg-indigo-400" />}
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none pt-0.5">
                                                        {period} Slots
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                                                    {slots.map((slot) => (
                                                        <TimeSlotButton
                                                            key={slot.id}
                                                            slot={slot}
                                                            selectedSlotId={rescheduleModal.availability_id}
                                                            onClick={(s) => setRescheduleModal(prev => ({ ...prev, time: s.time, availability_id: s.id }))}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}

                                    {availability.length === 0 && !appointmentsLoading && (
                                        <div className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                            <Clock className="text-slate-300 mb-2" size={32} />
                                            <p className="text-sm font-bold text-slate-400">No slots available for this date</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Fee</span>
                                        <span className="text-lg font-black text-slate-900">₹{practitionerFee?.fee || '0'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total to Pay</span>
                                        <div className="flex items-center gap-1.5 justify-end text-indigo-600">
                                            <Wallet size={16} />
                                            <span className="text-lg font-black leading-none">₹{practitionerFee?.fee || '0'}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleConfirmBooking}
                                    disabled={isSubmitting || !rescheduleModal.availability_id}
                                    className={cn(
                                        "w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                                        isSubmitting || !rescheduleModal.availability_id
                                            ? "bg-slate-300 cursor-not-allowed shadow-none"
                                            : "bg-indigo-600 hover:bg-slate-800 shadow-indigo-200 active:scale-[0.98]"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <CheckCircle2 size={20} />
                                            Confirm Booking
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* SOAP Note Modal */}
            <AnimatePresence>
                {soapModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20"
                        >
                            {/* Header */}
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Add SOAP Note</h3>
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <User size={12} /> {soapModal.appointment?.patient_name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (isTranscribing) recognition?.stop();
                                        setSoapModal(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className="p-2.5 hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                                {soapError && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                                        <AlertCircle size={18} /> {soapError}
                                    </div>
                                )}
                                {soapSuccess && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm font-bold">
                                        <CheckCircle2 size={18} /> SOAP Note saved successfully!
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {[
                                        { key: 'subjective', label: 'Subjective', letter: 'S', color: 'bg-indigo-600', placeholder: "Patient's reported symptoms, mental state, and history..." },
                                        { key: 'objective', label: 'Objective', letter: 'O', color: 'bg-emerald-600', placeholder: "Clinical observations, exams, and behavioral notes..." },
                                        { key: 'assessment', label: 'Assessment', letter: 'A', color: 'bg-amber-600', placeholder: "Clinical interpretation and progress evaluation..." },
                                        { key: 'plan', label: 'Plan', letter: 'P', color: 'bg-rose-600', placeholder: "Treatment steps, medications, and follow-ups..." }
                                    ].map(({ key, label, letter, color, placeholder }) => (
                                        <div
                                            key={key}
                                            className={cn(
                                                "space-y-3 p-1 rounded-[1.5rem] transition-all",
                                                soapModal.activeField === key ? "ring-2 ring-indigo-500 ring-offset-4" : ""
                                            )}
                                        >
                                            <div
                                                className="flex items-center justify-between cursor-pointer"
                                                onClick={() => setSoapModal(prev => ({ ...prev, activeField: key }))}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-8 h-8 rounded-xl text-white flex items-center justify-center text-xs font-black shadow-md", color)}>
                                                        {letter}
                                                    </div>
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">{label}</span>
                                                </div>
                                                {soapModal.activeField === key && <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1"><Mic size={10} className="animate-pulse" /> Active Field</span>}
                                            </div>
                                            <textarea
                                                value={soapModal.notes[key]}
                                                onChange={(e) => setSoapModal(prev => ({ ...prev, notes: { ...prev.notes, [key]: e.target.value }, activeField: key }))}
                                                onFocus={() => setSoapModal(prev => ({ ...prev, activeField: key }))}
                                                placeholder={placeholder}
                                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all min-h-[160px] max-h-[300px] resize-y placeholder:text-slate-300"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Conversation Field with Transcription Button Below */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pl-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xs font-black shadow-md">
                                                C
                                            </div>
                                            <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Conversation</span>
                                        </div>
                                        {isTranscribing && (
                                            <div className="flex items-center gap-2 text-red-500 animate-pulse">
                                                <Mic size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Listening...</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={soapModal.notes.conversation}
                                            onChange={(e) => setSoapModal(prev => ({ ...prev, notes: { ...prev.notes, conversation: e.target.value } }))}
                                            placeholder="Transcribe or enter notes from the clinical conversation here..."
                                            className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-violet-500/5 focus:bg-white focus:border-violet-400 transition-all min-h-[160px] max-h-[300px] resize-y placeholder:text-slate-300"
                                        />
                                    </div>
                                    <div className="flex justify-center">
                                        <button
                                            onClick={toggleTranscription}
                                            className={cn(
                                                "flex items-center gap-2 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                                                isTranscribing
                                                    ? "bg-red-500 text-white shadow-red-200 hover:bg-red-600"
                                                    : "bg-violet-600 text-white shadow-violet-200 hover:bg-slate-800"
                                            )}
                                        >
                                            {isTranscribing ? (
                                                <><X size={16} strokeWidth={3} /> Stop Conversation</>
                                            ) : (
                                                <><Mic size={16} strokeWidth={3} /> Start Conversation</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center gap-4">
                                <button
                                    onClick={() => setSoapModal(prev => ({ ...prev, isOpen: false, notes: { subjective: '', objective: '', assessment: '', plan: '', conversation: '' } }))}
                                    className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-all border border-slate-200 rounded-2xl bg-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSoapSubmit}
                                    disabled={isSavingSoap}
                                    className="flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSavingSoap ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={3} />}
                                    {isSavingSoap ? "Saving Note..." : "Save SOAP Note"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
