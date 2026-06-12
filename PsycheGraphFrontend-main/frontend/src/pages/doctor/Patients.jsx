import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, deletePatient, createPatient } from '../../store/slices/PatientSlice';
import { fetchAppointments, rescheduleAppointment, createAvailability, fetchUpdatedAppointments, fetchAvailability, createAppointment, deleteAppointment } from '../../store/slices/AppointmentSlice';
import { createSoapNote, fetchSessions, updateSession, uploadAudio, fetchPatientHistory } from '../../store/slices/SessionSlice';
import { fetchDoctorFee, clearDoctorFee } from '../../store/slices/AllUserSlice';
import { Search, PlayCircle, Trash2, FileText, Database, ChevronLeft, ChevronRight, Edit3, X, Eye, Video, Trash, Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, User, Stethoscope, MapPin, Wallet, Building, Edit2, RefreshCcw, Mic, MicOff, Send, AlertCircle, Pause, Play, Square, History, Phone, Mail, UserPlus, Users } from 'lucide-react';
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

export default function DoctorPatients() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments, availability, loading: appointmentsLoading } = useSelector((state) => state.appointments);
    const { list: sessions, patientHistory, loading: sessionLoading } = useSelector((state) => state.sessions);
    const { doctorFee } = useSelector((state) => state.users);
    const { user: authUser } = useSelector((state) => state.auth);
    const doctorId = authUser?.id || authUser?.user?.id || authUser?.doctor_id || '';

    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'a-z', 'z-a'
    const [filterDate, setFilterDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const [availableDates, setAvailableDates] = useState([]);

    // New Patient Intake Modal State
    const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        contact_number: '',
        date_of_birth: '',
        gender: '',
        address: '',
        organization_id: authUser?.organization_id || 1,
        // Optional consent tracking
        consent_signed: false,
        medical_history: ''
    });

    // Reschedule Modal State (Matches Receptionist Style)
    const [rescheduleModal, setRescheduleModal] = useState({
        isOpen: false,
        appointmentId: null,
        doctorId: null,
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
        notes: { subjective: '', objective: '', assessment: '', plan: '' },
        treatment_plan: '',
        sessionId: null,
        activeTab: 'notes'
    });
    const [isSavingSoap, setIsSavingSoap] = useState(false);
    const [soapSuccess, setSoapSuccess] = useState(false);
    const [soapError, setSoapError] = useState('');

    // Patient File Modal State
    const [isFileModalOpen, setIsFileModalOpen] = useState(false);
    const [selectedPatientForFile, setSelectedPatientForFile] = useState(null);

    const openFileModal = (patient) => {
        navigate(`/doctor/patient-file/${patient.id}`);
    };

    // Patient Appointments Modal State
    const [isAppointmentsModalOpen, setIsAppointmentsModalOpen] = useState(false);
    const [selectedPatientForAppointments, setSelectedPatientForAppointments] = useState(null);

    // Scheduled Sessions Modal State
    const [scheduledModal, setScheduledModal] = useState({
        isOpen: false,
        patient: null,
        sessions: []
    });

    const openAppointmentsModal = (patient) => {
        setSelectedPatientForAppointments(patient);
        setIsAppointmentsModalOpen(true);
    };

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isInitializingMic, setIsInitializingMic] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const prepareMic = async () => {
        if (streamRef.current) return;
        setIsInitializingMic(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
        } catch (err) {
            console.error("Microphone access denied:", err);
            setSoapError("Microphone access denied. Please enable permissions.");
        } finally {
            setIsInitializingMic(false);
        }
    };

    useEffect(() => {
        if (soapModal.activeTab === 'history' && soapModal.appointment?.patient_id) {
            dispatch(fetchPatientHistory(soapModal.appointment.patient_id));
        }
    }, [soapModal.activeTab, soapModal.appointment?.patient_id, dispatch]);

    const openSoapModal = async (app) => {
        // Find if a session with existing SOAP notes already exists for this appointment
        const existingSession = sessions.find(s => String(s.appointment_id) === String(app.id));
        const existingNotes = existingSession?.soap_notes || { subjective: '', objective: '', assessment: '', plan: '' };

        setSoapModal({
            isOpen: true,
            appointment: app,
            notes: { ...existingNotes },
            treatment_plan: existingSession?.treatment_plan || '',
            sessionId: existingSession?.id || null,
            activeTab: 'notes'
        });
        setSoapError('');
        setSoapSuccess(false);

        // Pre-warm mic stream
        await prepareMic();
    };

    const handleSoapSubmit = async (autoClose = true) => {
        if (!soapModal.appointment) return null;
        setIsSavingSoap(true);
        setSoapError('');

        try {
            let result;
            if (soapModal.sessionId) {
                // Update existing session
                result = await dispatch(updateSession({
                    id: soapModal.sessionId,
                    data: {
                        soap_notes: soapModal.notes,
                        treatment_plan: soapModal.treatment_plan,
                        patient_id: Number(soapModal.appointment.patient_id),
                        doctor_id: Number(doctorId),
                        appointment_id: Number(soapModal.appointment.id),
                    }
                })).unwrap();
            } else {
                // Create new session with SOAP notes
                result = await dispatch(createSoapNote({
                    patient_id: Number(soapModal.appointment.patient_id),
                    doctor_id: Number(doctorId),
                    appointment_id: Number(soapModal.appointment.id),
                    soap_notes: soapModal.notes,
                    treatment_plan: soapModal.treatment_plan
                })).unwrap();
            }

            if (autoClose) {
                setSoapSuccess(true);
                setTimeout(() => {
                    setSoapModal(prev => ({ ...prev, isOpen: false }));
                    setSoapSuccess(false);
                }, 2000);
            }

            const sid = result?.id || soapModal.sessionId || result?.data?.id;
            if (sid && !soapModal.sessionId) {
                setSoapModal(prev => ({ ...prev, sessionId: sid }));
            }

            dispatch(fetchSessions());
            return sid;
        } catch (err) {
            setSoapError(err || 'Failed to save SOAP note');
            return null;
        } finally {
            setIsSavingSoap(false);
        }
    };

    const startRecording = async () => {
        try {
            let stream = streamRef.current;
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
            }

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (audioChunksRef.current.length === 0) return;
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                let sid = soapModal.sessionId;
                if (!sid) {
                    sid = await handleSoapSubmit(false);
                }

                if (sid) {
                    try {
                        await dispatch(uploadAudio({ session_id: sid, audioBlob })).unwrap();
                        setSoapSuccess(true);
                        setTimeout(() => setSoapSuccess(false), 3000);
                        dispatch(fetchSessions());
                    } catch (err) {
                        setSoapError(err || 'Failed to upload audio');
                    }
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Recording Error:', err);
            setSoapError('Could not access microphone');
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            clearInterval(timerRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            clearInterval(timerRef.current);
            // Keep stream active for next recording while modal is open
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        if (rescheduleModal.isOpen && rescheduleModal.doctorId && rescheduleModal.date) {
            const orgId = authUser?.organization_id || authUser?.user?.organization_id;
            dispatch(fetchAvailability({
                doctor_id: rescheduleModal.doctorId,
                organization_id: orgId,
                start_date: rescheduleModal.date,
                end_date: rescheduleModal.date,
                only_available: true
            }));
        }
    }, [dispatch, rescheduleModal.isOpen, rescheduleModal.doctorId, rescheduleModal.date, authUser]);

    // Fetch Doctor Fee on Modal Open
    useEffect(() => {
        if (rescheduleModal.isOpen && rescheduleModal.doctorId) {
            dispatch(fetchDoctorFee(rescheduleModal.doctorId));
        } else {
            dispatch(clearDoctorFee());
        }
    }, [dispatch, rescheduleModal.isOpen, rescheduleModal.doctorId]);

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

    // Intake Form Submission
    const handleIntakeSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Patient payload matching the backend schemas
            const payload = {
                full_name: formData.full_name,
                email: formData.email,
                contact_number: formData.contact_number,
                gender: formData.gender,
                address: formData.address,
                organization_id: formData.organization_id,
                date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString().split('T')[0] : null,
                // These are mock fields for the consent/history depending on Redux support
                // metadata: JSON.stringify({ medical_history: formData.medical_history, consent_signed: formData.consent_signed })
            };

            // Using PatientSlice action
            // NOTE: Need to ensure createPatient is correctly hooked up in PatientSlice to hit POST /patients
            await dispatch(createPatient(payload)).unwrap();

            alert('Patient registered successfully');
            setIsIntakeModalOpen(false);
            setFormData({
                full_name: '', email: '', contact_number: '', date_of_birth: '', gender: '', address: '',
                organization_id: authUser?.organization_id || 1, consent_signed: false, medical_history: ''
            });

            // Refresh the patients list
            dispatch(fetchPatients());
        } catch (err) {
            console.error('Failed to create patient:', err);
            alert('Failed to register patient. Please check the details and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Patient Directory Filtering & Sorting
    const filteredPatients = useMemo(() => {
        let result = [...patients];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                (p.full_name || '').toLowerCase().includes(query) ||
                (p.contact_number || '').includes(query) ||
                (p.email || '').toLowerCase().includes(query)
            );
        }

        if (filterDate) {
            result = result.filter(p => {
                const pAppts = appointments.filter(a => String(a.patient_id) === String(p.id));
                return pAppts.some(a => {
                    if (!a.start_time) return false;
                    const d = new Date(a.start_time);
                    if (isNaN(d.getTime())) return false;
                    const dateStr = d.toISOString().split('T')[0];
                    return dateStr === filterDate;
                });
            });
        }

        // Sorting
        result.sort((a, b) => {
            switch (sortOrder) {
                case 'a-z': return (a.full_name || '').localeCompare(b.full_name || '');
                case 'z-a': return (b.full_name || '').localeCompare(a.full_name || '');
                case 'oldest': return new Date(a.created_at || 0) - new Date(b.created_at || 0);
                case 'newest':
                default:
                    return new Date(b.created_at || Date.now()) - new Date(a.created_at || 0);
            }
        });

        return result;
    }, [patients, appointments, searchQuery, sortOrder, filterDate]);

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortOrder, filterDate]);

    const openRescheduleModal = (app) => {
        if (!app) return;
        const d = new Date(app.start_time);
        setRescheduleModal({
            isOpen: true,
            appointmentId: app.id,
            patientId: app.patient_id,
            doctorId: app.doctor_id || doctorId,
            date: getLocalDateStr(d),
            time: '',
            availability_id: '',
            booking_type: app.booking_type || 'offline',
            notes: app.notes || ''
        });
    };

    const handleScheduleNew = (patient) => {
        setRescheduleModal({
            isOpen: true,
            appointmentId: null,
            patientId: patient.id,
            doctorId: doctorId,
            date: getLocalDateStr(new Date()),
            time: '',
            availability_id: '',
            booking_type: 'offline',
            notes: ''
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
                doctor_id: parseInt(rescheduleModal.doctorId),
                start_time: selectedSlot?.start_time,
                end_time: selectedSlot?.end_time,
                notes: rescheduleModal.notes,
                meet_link: null,
                availability_id: parseInt(rescheduleModal.availability_id),
                booking_type: rescheduleModal.booking_type,
                fee: parseFloat(doctorFee?.fee || 0)
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
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Patient Directory</h2>
                    <p className="text-slate-500 font-medium">Manage all your patients and session files</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsIntakeModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
                    >
                        <UserPlus size={18} />
                        New Intake
                    </button>
                    <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center">
                        <input 
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="pl-4 pr-2 py-1.5 bg-transparent text-xs font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
                        />
                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="pl-2 pr-10 py-1.5 bg-transparent text-xs font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[position:right_1rem_center]"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="a-z">Name (A-Z)</option>
                            <option value="z-a">Name (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white p-2 flex items-center rounded-2xl border border-slate-200 shadow-sm relative">
                <div className="absolute left-6">
                    <Search className="text-slate-400" size={18} />
                </div>
                <input
                    type="text"
                    placeholder="Search patients by name, email, or contact..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 text-sm font-medium outline-none bg-transparent"
                />
            </div>

            {filteredPatients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((patient, index) => {
                        const patientAppointments = appointments.filter(a => String(a.patient_id) === String(patient.id));
                        patientAppointments.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
                        const lastAppt = patientAppointments[0];

                        return (
                            <motion.div
                                key={patient.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col relative overflow-hidden group"
                            >
                                {/* Decorative Background Elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[120px] -z-0 group-hover:bg-indigo-100/50 transition-colors" />
                                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-slate-50 rounded-full -z-0 opacity-50 blur-3xl group-hover:opacity-80 transition-opacity" />

                                <div className="p-6 flex-1 flex flex-col z-10">
                                    {/* Header: Basic Info Top */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0 group-hover:scale-110 transition-transform duration-500">
                                                <span className="text-xl font-black">{patient.full_name?.[0]?.toUpperCase() || 'U'}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-black text-slate-900 truncate tracking-tight leading-tight mb-1" title={patient.full_name}>
                                                    {patient.full_name}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                                        {patient.gender || 'Unknown'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                                        ID: #{patient.id}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Body: Detailed Basic Info */}
                                    <div className="space-y-2.5 mb-6">
                                        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100/50 group-hover:bg-white transition-colors">
                                            <div className="p-1.5 bg-white text-slate-400 rounded-lg shadow-sm">
                                                <Phone size={12} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 truncate">{patient.contact_number || 'No contact provided'}</span>
                                        </div>
                                        {patient.email && (
                                            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100/50 group-hover:bg-white transition-colors">
                                                <div className="p-1.5 bg-white text-slate-400 rounded-lg shadow-sm">
                                                    <Mail size={12} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-600 truncate">{patient.email}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Appointment Info Section */}
                                    <div className="mb-6">
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <Clock size={14} className="text-indigo-500" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Appointment History</span>
                                        </div>
                                        <div className={cn(
                                            "p-4 rounded-2xl border transition-all",
                                            lastAppt 
                                                ? "bg-indigo-50/30 border-indigo-100/50 group-hover:bg-indigo-50/50" 
                                                : "bg-slate-50 border-slate-100"
                                        )}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Latest Visit</span>
                                                {lastAppt && (
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase border",
                                                        lastAppt.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                                    )}>
                                                        {lastAppt.status}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-black text-slate-800">
                                                {lastAppt 
                                                    ? new Date(lastAppt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : 'No recorded visits'
                                                }
                                            </p>
                                            {lastAppt && (
                                                <p className="text-[10px] font-bold text-slate-500 mt-1">
                                                    {new Date(lastAppt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {lastAppt.booking_type}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons: 3 Column Grid */}
                                    <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-slate-100">
                                        <button
                                            onClick={() => openFileModal(patient)}
                                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-slate-100 bg-white text-slate-500 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100 transition-all group/btn shadow-sm"
                                            title="View File"
                                        >
                                            <div className="p-2 bg-slate-50 rounded-lg group-hover/btn:bg-indigo-50 transition-colors">
                                                <FileText size={16} />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-tighter">File</span>
                                        </button>
                                        <button
                                            onClick={() => openAppointmentsModal(patient)}
                                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-slate-100 bg-white text-slate-500 hover:bg-slate-50 hover:text-amber-600 hover:border-amber-100 transition-all group/btn shadow-sm"
                                            title="Appointments"
                                        >
                                            <div className="p-2 bg-slate-50 rounded-lg group-hover/btn:bg-amber-50 transition-colors">
                                                <Stethoscope size={16} />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-tighter">Visit</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const scheduledForDoctor = appointments.filter(a => 
                                                    String(a.patient_id) === String(patient.id) && 
                                                    String(a.doctor_id) === String(doctorId) && 
                                                    (a.status?.toUpperCase() === 'SCHEDULED' || a.status?.toUpperCase() === 'CONFIRMED' || a.status?.toUpperCase() === 'COMPLETED')
                                                );

                                                if (scheduledForDoctor.length > 0) {
                                                    setScheduledModal({
                                                        isOpen: true,
                                                        patient: patient,
                                                        sessions: scheduledForDoctor
                                                    });
                                                } else {
                                                    handleScheduleNew(patient);
                                                }
                                            }}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all group/btn shadow-lg",
                                                appointments.some(a => 
                                                    String(a.patient_id) === String(patient.id) && 
                                                    String(a.doctor_id) === String(doctorId) && 
                                                    (a.status?.toUpperCase() === 'SCHEDULED' || a.status?.toUpperCase() === 'CONFIRMED')
                                                )
                                                    ? "border-indigo-600 bg-indigo-600 text-white hover:bg-slate-900 hover:border-slate-900 shadow-indigo-100"
                                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100 shadow-slate-100"
                                            )}
                                            title={appointments.some(a => 
                                                String(a.patient_id) === String(patient.id) && 
                                                String(a.doctor_id) === String(doctorId) && 
                                                (a.status?.toUpperCase() === 'SCHEDULED' || a.status?.toUpperCase() === 'CONFIRMED')
                                            ) ? "Start Session" : "Schedule Appointment"}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg transition-colors",
                                                appointments.some(a => 
                                                    String(a.patient_id) === String(patient.id) && 
                                                    String(a.doctor_id) === String(doctorId) && 
                                                    (a.status?.toUpperCase() === 'SCHEDULED' || a.status?.toUpperCase() === 'CONFIRMED' || a.status?.toUpperCase() === 'COMPLETED')
                                                ) ? "bg-white/20" : "bg-slate-50 group-hover/btn:bg-indigo-50"
                                            )}>
                                                {appointments.some(a => 
                                                    String(a.patient_id) === String(patient.id) && 
                                                    String(a.doctor_id) === String(doctorId) && 
                                                    (a.status?.toUpperCase() === 'SCHEDULED' || a.status?.toUpperCase() === 'CONFIRMED')
                                                ) ? (
                                                    <PlayCircle size={16} />
                                                ) : (
                                                    <CalendarIcon size={16} />
                                                )}
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-tighter">
                                                {appointments.some(a => 
                                                    String(a.patient_id) === String(patient.id) && 
                                                    String(a.doctor_id) === String(doctorId) && 
                                                    (a.status?.toUpperCase() === 'SCHEDULED' || a.status?.toUpperCase() === 'CONFIRMED' || a.status?.toUpperCase() === 'COMPLETED')
                                                ) ? "Sessions" : "Schedule"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="p-20 text-center bg-white rounded-3xl border border-slate-200">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-slate-50 border border-slate-100 mb-6 shadow-inner">
                        <Users size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight mb-1">No Patients Found</h3>
                    <p className="text-sm font-medium text-slate-400">Add a new patient or tweak your search filters.</p>
                </div>
            )}

            {filteredPatients.length > itemsPerPage && (
                <div className="flex items-center justify-center gap-2 mt-8">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all disabled:opacity-50"><ChevronLeft size={18} /></button>
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-600">
                        Page {currentPage} of {Math.ceil(filteredPatients.length / itemsPerPage)}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPatients.length / itemsPerPage), p + 1))} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all disabled:opacity-50"><ChevronRight size={18} /></button>
                </div>
            )}

            {/* New Intake Modal Overlay */}
            <AnimatePresence>
                {isIntakeModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-indigo-50">
                                        <UserPlus size={18} className="text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">New Patient Intake</h3>
                                </div>
                                <button onClick={() => setIsIntakeModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleIntakeSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                    <input required type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium" placeholder="E.g. Jane Doe" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact</label>
                                        <input required type="tel" maxLength={10} value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value.replace(/[^0-9]/g, '') })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium" placeholder="10-digit number" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">DOB</label>
                                        <input required type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                                        <select required value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium appearance-none">
                                            <option value="">Select</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email (Optional)</label>
                                        <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium" placeholder="email@example.com" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                                    <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium min-h-[80px]" placeholder="Patient's full residential address..." />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Initial Medical History / Notes</label>
                                    <textarea value={formData.medical_history} onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium min-h-[80px]" placeholder="Brief notes about the patient's condition or history..." />
                                </div>

                                <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                                    <input type="checkbox" required checked={formData.consent_signed} onChange={(e) => setFormData({ ...formData, consent_signed: e.target.checked })} className="mt-1 w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">Patient has provided explicit consent for clinical record generation.</span>
                                </label>

                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setIsIntakeModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
                                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Create File'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
                                        <span className="text-lg font-black text-slate-900">₹{doctorFee?.fee || '0'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total to Pay</span>
                                        <div className="flex items-center gap-1.5 justify-end text-indigo-600">
                                            <Wallet size={16} />
                                            <span className="text-lg font-black leading-none">₹{doctorFee?.fee || '0'}</span>
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

            <AnimatePresence>
                {soapModal.isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 10 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
                        >
                            {/* Header */}
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Add SOAP Note</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <User size={12} className="text-slate-400" />
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{soapModal.appointment?.patient_name}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {isRecording && (
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border transition-all",
                                            isPaused ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-red-50 text-red-600 border-red-100"
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full", isPaused ? "bg-amber-600" : "bg-red-600 animate-pulse")} />
                                            <span className="text-[11px] font-bold tabular-nums">{formatTime(recordingTime)}</span>
                                            {isPaused && <span className="text-[9px] font-black uppercase tracking-tighter ml-1">Paused</span>}
                                        </div>
                                    )}
                                    {isRecording ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={isPaused ? resumeRecording : pauseRecording}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-md",
                                                    isPaused
                                                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                                                        : "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200"
                                                )}
                                            >
                                                {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                                {isPaused ? "Resume" : "Pause"}
                                            </button>
                                            <button
                                                onClick={stopRecording}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-red-700 transition-all shadow-md shadow-red-200"
                                            >
                                                <Square size={14} fill="currentColor" />
                                                Save Recording
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={startRecording}
                                            disabled={isInitializingMic}
                                            className={cn(
                                                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                                                "bg-[#062f3f] text-white hover:bg-slate-800 shadow-md shadow-slate-200",
                                                isInitializingMic && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {isInitializingMic ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                                            {isInitializingMic ? "Connecting..." : "Start Recording"}
                                        </button>
                                    )}
                                    <div className="w-px h-6 bg-slate-100 mx-1" />
                                    <button
                                        onClick={() => {
                                            if (isRecording) stopRecording();
                                            if (streamRef.current) {
                                                streamRef.current.getTracks().forEach(t => t.stop());
                                                streamRef.current = null;
                                            }
                                            setSoapModal(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Tab Switcher */}
                            <div className="flex border-b border-slate-100 bg-slate-50/30 px-8">
                                <button
                                    onClick={() => setSoapModal(prev => ({ ...prev, activeTab: 'notes' }))}
                                    className={cn(
                                        "px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative",
                                        soapModal.activeTab === 'notes' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    SOAP Notes
                                    {soapModal.activeTab === 'notes' && (
                                        <motion.div layoutId="tab-underline-patients" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setSoapModal(prev => ({ ...prev, activeTab: 'history' }))}
                                    className={cn(
                                        "px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative",
                                        soapModal.activeTab === 'history' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Patient History
                                    {soapModal.activeTab === 'history' && (
                                        <motion.div layoutId="tab-underline-patients" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
                                    )}
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {soapModal.activeTab === 'notes' ? (
                                    <>
                                        {isInitializingMic && (
                                            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-indigo-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                <Loader2 size={16} className="animate-spin" /> Initializing Professional Audio Stream...
                                            </div>
                                        )}
                                        {soapError && (
                                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold uppercase tracking-wide">
                                                <AlertCircle size={16} /> {soapError}
                                            </div>
                                        )}
                                        {soapSuccess && (
                                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-600 text-xs font-bold uppercase tracking-wide">
                                                <CheckCircle2 size={16} /> SOAP Note saved successfully!
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {[
                                                { key: 'subjective', label: 'Subjective', letter: 'S', color: 'text-indigo-600 bg-indigo-50', placeholder: "Patient's reported symptoms and mental state..." },
                                                { key: 'objective', label: 'Objective', letter: 'O', color: 'text-emerald-600 bg-emerald-50', placeholder: "Clinical observations and behavioral notes..." },
                                                { key: 'assessment', label: 'Assessment', letter: 'A', color: 'text-amber-600 bg-amber-50', placeholder: "Clinical interpretation and findings..." },
                                                { key: 'plan', label: 'Plan', letter: 'P', color: 'text-rose-600 bg-rose-50', placeholder: "Treatment steps and follow-up clinical plan..." }
                                            ].map(({ key, label, letter, color, placeholder }) => (
                                                <div key={key} className="flex flex-col">
                                                    <div className="flex items-center gap-2 mb-3 pl-1">
                                                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black", color)}>
                                                            {letter}
                                                        </div>
                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                                                    </div>
                                                    <textarea
                                                        value={soapModal.notes[key]}
                                                        onChange={(e) => setSoapModal(prev => ({ ...prev, notes: { ...prev.notes, [key]: e.target.value } }))}
                                                        placeholder={placeholder}
                                                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all min-h-[140px] placeholder:text-slate-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8 flex flex-col">
                                            <div className="flex items-center gap-2 mb-3 pl-1">
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-cyan-600 bg-cyan-50">
                                                    T
                                                </div>
                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Treatment Plan</span>
                                            </div>
                                            <textarea
                                                value={soapModal.treatment_plan}
                                                onChange={(e) => setSoapModal(prev => ({ ...prev, treatment_plan: e.target.value }))}
                                                placeholder="Long-term treatment strategies and clinical goals..."
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-400 transition-all min-h-[120px] placeholder:text-slate-300"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        {sessionLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                                <Loader2 size={40} className="text-indigo-500 animate-spin" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Clinical History...</p>
                                            </div>
                                        ) : !patientHistory?.current_sessions?.length ? (
                                            <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                                    <History size={32} />
                                                </div>
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">No Previous Sessions</h4>
                                                <p className="text-xs text-slate-500 mt-2 max-w-xs font-medium">This patient doesn't have any historical SOAP notes recorded in our system yet.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {patientHistory.current_sessions.map((session) => (
                                                    <div key={session.id} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                        <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Session Date</span>
                                                                    <div className="flex items-center gap-2 text-slate-700 font-black text-sm">
                                                                        <CalendarIcon size={14} className="text-indigo-500" />
                                                                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </div>
                                                                </div>
                                                                <div className="w-px h-8 bg-slate-200" />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Time</span>
                                                                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm tabular-nums">
                                                                        <Clock size={14} className="text-indigo-500" />
                                                                        {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                                Version {session.version}
                                                            </div>
                                                        </div>
                                                        <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6">
                                                            {['subjective', 'objective', 'assessment', 'plan'].map(field => (
                                                                <div key={field} className="space-y-2">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1">
                                                                        {field}
                                                                    </span>
                                                                    <div className="p-4 bg-slate-50 rounded-2xl text-[13px] font-bold text-slate-700 leading-relaxed min-h-[60px]">
                                                                        {session.soap_notes?.[field] || <span className="text-slate-300 italic font-medium">No {field} notes recorded.</span>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {session.treatment_plan && (
                                                            <div className="px-8 pb-8">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1 mb-2">
                                                                    treatment plan
                                                                </span>
                                                                <div className="p-4 bg-cyan-50/50 border border-cyan-100/50 rounded-2xl text-[13px] font-bold text-slate-700 leading-relaxed">
                                                                    {session.treatment_plan}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <button
                                    onClick={() => {
                                        if (isRecording) stopRecording();
                                        if (streamRef.current) {
                                            streamRef.current.getTracks().forEach(t => t.stop());
                                            streamRef.current = null;
                                        }
                                        setSoapModal(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                                >
                                    Cancel
                                </button>
                                {soapModal.activeTab === 'notes' && (
                                    <button
                                        onClick={() => handleSoapSubmit()}
                                        disabled={isSavingSoap}
                                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200 hover:bg-slate-800 transition-all flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {isSavingSoap ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        Save SOAP Note
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Patient File Modal: Detailed Clinical History */}
            <AnimatePresence>
                {isFileModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-white"
                        >
                            {/* Modal Header */}
                            <div className="px-10 py-7 bg-white border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-200">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Clinical Records</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <User size={14} className="text-slate-400" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                Patient: <span className="text-indigo-600">{selectedPatientForFile?.full_name}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsFileModalOpen(false)}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                                {sessionLoading ? (
                                    <div className="h-64 flex flex-col items-center justify-center gap-4">
                                        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Analyzing Patient History...</p>
                                    </div>
                                ) : !patientHistory?.current_sessions?.length ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                                            <FileText size={40} />
                                        </div>
                                        <h4 className="text-xl font-black text-slate-800 tracking-tight">No Historical Records Found</h4>
                                        <p className="text-sm text-slate-500 mt-2 max-w-sm font-medium">This patient does not have any clinical session files recorded in the system yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {[...patientHistory.current_sessions]
                                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                                            .map((session, sIdx) => (
                                            <motion.div
                                                key={session.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: sIdx * 0.1 }}
                                                className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group/card"
                                            >
                                                {/* Session Card Header */}
                                                <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between group-hover/card:bg-white transition-colors">
                                                    <div className="flex items-center gap-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Session</span>
                                                            <span className="text-lg font-black text-slate-900">#{session.session_number || sIdx + 1}</span>
                                                        </div>
                                                        <div className="w-px h-8 bg-slate-200" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date & Time</span>
                                                            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                                                                <CalendarIcon size={14} className="text-indigo-500" />
                                                                {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                <span className="text-slate-300 mx-1">•</span>
                                                                <Clock size={14} className="text-indigo-500" />
                                                                {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                            Ver {session.version}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Session Card Body */}
                                                <div className="p-8 space-y-8">
                                                    {/* SOAP Grid */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {[
                                                            { label: 'Subjective', key: 'subjective', color: 'bg-indigo-50 text-indigo-600' },
                                                            { label: 'Objective', key: 'objective', color: 'bg-emerald-50 text-emerald-600' },
                                                            { label: 'Assessment', key: 'assessment', color: 'bg-amber-50 text-amber-600' },
                                                            { label: 'Plan', key: 'plan', color: 'bg-rose-50 text-rose-600' }
                                                        ].map(soap => (
                                                            <div key={soap.key} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black", soap.color)}>
                                                                        {soap.label[0]}
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{soap.label}</span>
                                                                </div>
                                                                <p className="text-xs font-bold text-slate-700 leading-relaxed min-h-[40px]">
                                                                    {session.soap_notes?.[soap.key] || <span className="text-slate-300 italic font-medium">No record.</span>}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Summary & Transcript Section */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <FileText size={14} className="text-indigo-500" />
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Summary</span>
                                                            </div>
                                                            <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xs font-bold text-slate-600 leading-6 h-full">
                                                                {session.summary ? (
                                                                    <div className="whitespace-pre-line">{session.summary}</div>
                                                                ) : (
                                                                    <span className="text-slate-300 italic font-medium">No summary generated for this session.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Mic size={14} className="text-indigo-500" />
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Transcript</span>
                                                            </div>
                                                            <div className="p-6 bg-white border border-slate-100 rounded-[1.5rem] text-xs font-bold text-slate-500 leading-6 max-h-[180px] overflow-y-auto custom-scrollbar italic">
                                                                {session.transcript ? (
                                                                    `"${session.transcript}"`
                                                                ) : (
                                                                    <span className="text-slate-300 italic font-medium">No transcript available.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-10 py-6 bg-white border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setIsFileModalOpen(false)}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                >
                                    Close Records
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Patient Appointments Modal: Visit History Timeline */}
            <AnimatePresence>
                {isAppointmentsModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100"
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
                                        <CalendarIcon size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Visit History</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            Patient: <span className="text-slate-600">{selectedPatientForAppointments?.full_name}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAppointmentsModalOpen(false)}
                                    className="p-2 hover:bg-white hover:text-red-500 transition-all rounded-xl text-slate-400 group"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {appointments.filter(a => String(a.patient_id) === String(selectedPatientForAppointments?.id)).length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-center opacity-60">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                                            <CalendarIcon size={32} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">No appointments found for this patient.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {appointments
                                            .filter(a => String(a.patient_id) === String(selectedPatientForAppointments?.id))
                                            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
                                            .map((appt, idx) => (
                                            <motion.div
                                                key={appt.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                                                            {new Date(appt.start_time).toLocaleDateString('en-US', { month: 'short' })}
                                                        </span>
                                                        <span className="text-lg font-black text-slate-900 leading-none">
                                                            {new Date(appt.start_time).getDate()}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-slate-800 tracking-tight">
                                                                {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border",
                                                                appt.booking_type === 'online' ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                                            )}>
                                                                {appt.booking_type}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] font-bold text-slate-500 whitespace-pre-wrap max-w-sm">
                                                            {appt.notes || 'No visit summary provided.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                        appt.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                        appt.status === 'CANCELLED' ? "bg-red-50 text-red-600 border-red-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                    )}>
                                                        {appt.status}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setIsAppointmentsModalOpen(false)}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Scheduled Sessions Modal */}
            <AnimatePresence>
                {scheduledModal.isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100"
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                                        <PlayCircle size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Patient Sessions</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            Patient: <span className="text-slate-600">{scheduledModal.patient?.full_name}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setScheduledModal({ isOpen: false, patient: null, sessions: [] })}
                                    className="p-2 hover:bg-white hover:text-red-500 transition-all rounded-xl text-slate-400 group"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {scheduledModal.sessions.length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-center opacity-60">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                                            <CalendarIcon size={32} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">No scheduled sessions found.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {scheduledModal.sessions
                                            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                                            .map((appt, idx) => (
                                            <motion.div
                                                key={appt.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                                                            {new Date(appt.start_time).toLocaleDateString('en-US', { month: 'short' })}
                                                        </span>
                                                        <span className="text-lg font-black text-slate-900 leading-none">
                                                            {new Date(appt.start_time).getDate()}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-slate-800 tracking-tight">
                                                                {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border",
                                                                appt.booking_type === 'online' ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                                            )}>
                                                                {appt.booking_type}
                                                            </span>
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border",
                                                                appt.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                                                                appt.status === 'CANCELLED' ? "bg-red-50 text-red-600 border-red-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                            )}>
                                                                {appt.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] font-bold text-slate-500 whitespace-pre-wrap max-w-sm">
                                                            {appt.notes || 'No notes provided.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                {appt.status === 'COMPLETED' ? (
                                                    <button
                                                        onClick={() => {
                                                            setScheduledModal({ isOpen: false, patient: null, sessions: [] });
                                                            openFileModal(scheduledModal.patient);
                                                        }}
                                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md shrink-0"
                                                    >
                                                        <FileText size={16} />
                                                        View Records
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setScheduledModal(prev => ({ ...prev, isOpen: false }));
                                                            window.location.href = `/doctor/session/${appt.id}/${scheduledModal.patient.id}`;
                                                        }}
                                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-indigo-200 shrink-0"
                                                    >
                                                        <PlayCircle size={16} />
                                                        Start Session
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sessions</span>
                                    <p className="text-sm font-black text-slate-800">
                                        {scheduledModal.sessions.every(s => s.status === 'COMPLETED') 
                                            ? "All visits completed" 
                                            : `${scheduledModal.sessions.filter(s => s.status !== 'COMPLETED').length} active appointment(s)`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setScheduledModal({ isOpen: false, patient: null, sessions: [] })}
                                        className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                                    >
                                        Dismiss
                                    </button>
                                    {scheduledModal.sessions.every(s => s.status === 'COMPLETED') && (
                                        <button
                                            onClick={() => {
                                                setScheduledModal({ isOpen: false, patient: null, sessions: [] });
                                                handleScheduleNew(scheduledModal.patient);
                                            }}
                                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200"
                                        >
                                            <CalendarIcon size={16} />
                                            Schedule New
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
