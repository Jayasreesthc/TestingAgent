import { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    Calendar as CalendarIcon, 
    X, 
    Loader2, 
    ChevronRight, 
    User, 
    ChevronLeft, 
    Stethoscope, 
    MapPin, 
    Building, 
    Video, 
    AlertCircle,
    Search,
    Phone,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
    fetchAppointments, 
    createAppointment, 
    rescheduleAppointment, 
    fetchAvailability 
} from '../store/slices/AppointmentSlice';
import { fetchPatients } from '../store/slices/PatientSlice';
import { fetchDoctorFee, clearDoctorFee } from '../store/slices/AllUserSlice';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Global Local Date Helper (YYYY-MM-DD)
const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper for Time Slot Component
function TimeSlotButton({ slot, selectedSlotId, onClick }) {
    const isSelected = String(selectedSlotId) === String(slot.id);
    const isBooked = slot.isBooked;
    return (
        <button
            type="button"
            onClick={() => !isBooked && onClick(slot)}
            disabled={isBooked}
            className={cn(
                "px-2 py-2.5 rounded-xl text-sm font-bold border transition-all relative overflow-hidden",
                isBooked
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : isSelected
                        ? "bg-primary-600 text-white border-primary-600 shadow-md transform scale-105 z-10"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
            )}
            title={isBooked ? "Slot Already Booked" : ""}
        >
            <span className={isBooked ? "opacity-40 line-through decoration-slate-400" : ""}>{slot.time}</span>
            {isBooked && (
                <div className="absolute inset-0 bg-slate-500/5 flex items-center justify-center pointer-events-none">
                </div>
            )}
        </button>
    );
}

export default function AppointmentModal({ isOpen, onClose, initialData = null, isRescheduling = false, doctorOverride = null }) {
    const dispatch = useDispatch();
    const { availability } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { list: users, doctorFee } = useSelector((state) => state.users);
    const { user: currentUser } = useSelector((state) => state.auth);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [visitType, setVisitType] = useState('Hospital');
    const [availableDates, setAvailableDates] = useState([]);
    const [formData, setFormData] = useState({
        patient_id: '',
        doctor_id: '',
        date: '',
        time: '',
        notes: '',
        meet_link: '',
        availability_id: ''
    });

    // Searchable Patient Dropdown States
    const [patientSearch, setPatientSearch] = useState('');
    const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
    const patientDropdownRef = useRef(null);

    const filteredPatients = useMemo(() => {
        if (!patientSearch) return patients;
        const query = patientSearch.toLowerCase();
        return patients.filter(p => 
            (p.full_name || '').toLowerCase().includes(query) ||
            (p.contact_number || '').includes(query)
        );
    }, [patients, patientSearch]);

    const selectedPatient = useMemo(() => {
        return patients.find(p => String(p.id) === String(formData.patient_id));
    }, [patients, formData.patient_id]);

    // Outside click detection
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target)) {
                setIsPatientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Extract assignment and mapping logic
    const doctors = useMemo(() => {
        // If the calling context provides a doctor override (e.g., from the doctor's own calendar),
        // use that directly and skip the assigned_doctors lookup.
        if (doctorOverride) {
            return [doctorOverride];
        }

        const profileAssignedDoctors =
            currentUser?.assigned_doctors ||
            currentUser?.user?.assigned_doctors ||
            currentUser?.details?.assigned_doctors ||
            currentUser?.doctor?.assigned_doctors;

        if (!Array.isArray(profileAssignedDoctors) || profileAssignedDoctors.length === 0) {
            return [];
        }

        return profileAssignedDoctors.map((d) => {
            const searchName = (d.full_name || d.name || "").toLowerCase().replace(/^dr\.?\s+/i, "").trim();
            const matchingUser = users.find(u => {
                if (u.role !== 'DOCTOR' && !u.is_doctor) return false;
                const uName = (u.full_name || u.name || "").toLowerCase().replace(/^dr\.?\s+/i, "").trim();
                return uName === searchName || String(u.id) === String(d.id) || String(u.user_id) === String(d.id);
            });
            const realDoctorId = matchingUser?.id || matchingUser?.user_id || d.id;
            return {
                id: String(realDoctorId),
                full_name: matchingUser?.full_name || d.full_name || d.name || "Unknown Practitioner",
                role: 'DOCTOR',
                metadata: matchingUser?.description || matchingUser?.metadata || d.metadata
            };
        });
    }, [users, currentUser, doctorOverride]);

    const [selectedDoctor, setSelectedDoctor] = useState(null);

    // Effect for initial calculation of dates
    useEffect(() => {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const localDateStr = getLocalDateStr(d);

            dates.push({
                dateObj: d,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: d.getDate(),
                fullDate: localDateStr,
                month: d.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        setAvailableDates(dates);
        if (!formData.date && dates.length > 0) setFormData(prev => ({ ...prev, date: dates[0].fullDate }));
    }, []);

    // Handle initialData for rescheduling OR pre-filling availability slot
    useEffect(() => {
        if (isOpen && isRescheduling && initialData) {
            setFormData({
                patient_id: String(initialData.patient_id),
                doctor_id: String(initialData.doctor_id),
                date: getLocalDateStr(initialData.start_time),
                time: new Date(initialData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                notes: initialData.notes || '',
                meet_link: initialData.meet_link || '',
                availability_id: initialData.availability_id || ''
            });
            setVisitType(initialData.meet_link ? 'Video' : 'Hospital');
            setStep(2); // Jump to step 2 for rescheduling
        } else if (isOpen && !isRescheduling) {
            // Reset form for new appointment, but pre-fill slot data if provided
            const preDate = initialData?.start_time ? getLocalDateStr(initialData.start_time) : '';
            const preAvailabilityId = initialData?.availability_id || '';
            const preDoctorId = doctorOverride ? String(doctorOverride.id) : (doctors.length === 1 ? String(doctors[0].id) : '');
            setFormData(prev => ({
                ...prev,
                patient_id: '',
                doctor_id: preDoctorId,
                date: preDate || availableDates[0]?.fullDate || prev.date,
                time: '',
                notes: '',
                meet_link: '',
                availability_id: preAvailabilityId
            }));
            // Clear searchable dropdown state
            setPatientSearch('');
            setIsPatientDropdownOpen(false);
            
            // Always start at step 1 for new appointments so user can select a patient
            setStep(1);
            setVisitType('Hospital');
        }
    }, [isOpen, isRescheduling, initialData, doctors, availableDates, doctorOverride]);

    // Derived state for selected doctor card
    useEffect(() => {
        if (formData.doctor_id) {
            const doc = doctors.find(d => String(d.id) === String(formData.doctor_id));
            setSelectedDoctor(doc);
            dispatch(fetchDoctorFee(formData.doctor_id));
        } else {
            setSelectedDoctor(null);
            dispatch(clearDoctorFee());
        }
    }, [formData.doctor_id, doctors, dispatch]);

    // Fetch availability when doctor or date changes
    useEffect(() => {
        if (isOpen && formData.doctor_id && formData.date && currentUser) {
            const orgIdValue = currentUser?.organization_id || currentUser?.user?.organization_id;
            dispatch(fetchAvailability({
                doctor_id: formData.doctor_id,
                organization_id: orgIdValue,
                start_date: formData.date,
                end_date: formData.date,
                only_available: true
            }));
        }
    }, [dispatch, isOpen, formData.doctor_id, formData.date, currentUser]);

    const timeSlots = useMemo(() => {
        const morning = [];
        const afternoon = [];
        const evening = [];

        if (!Array.isArray(availability)) return { morning, afternoon, evening };

        availability.forEach(slot => {
            const date = new Date(slot.start_time);
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            const slotObj = {
                time: timeStr,
                id: slot.id,
                isBooked: slot.is_booked
            };

            if (hours >= 5 && hours < 12) {
                morning.push(slotObj);
            } else if (hours >= 12 && hours < 17) {
                afternoon.push(slotObj);
            } else {
                evening.push(slotObj);
            }
        });

        return { morning, afternoon, evening };
    }, [availability]);

    const handlePatientChange = (patientId) => {
        const selectedPatient = patients.find(p => String(p.id) === String(patientId));
        setFormData(prev => ({
            ...prev,
            patient_id: patientId,
            doctor_id: selectedPatient?.doctor_id && doctors.some(d => String(d.id) === String(selectedPatient.doctor_id))
                ? String(selectedPatient.doctor_id)
                : (doctors.length === 1 ? String(doctors[0].id) : prev.doctor_id)
        }));
    };

    const handleNextStep = () => {
        if (step === 1 && formData.patient_id && formData.doctor_id) {
            setStep(2);
        }
    };

    const handlePrevStep = () => {
        if (!isRescheduling) {
            setFormData(prev => ({ ...prev, patient_id: '' }));
            setPatientSearch('');
        }
        setStep(1);
    };

    const handleSubmitAppointment = async (e) => {
        if (e) e.preventDefault();
        if (!formData.availability_id) {
            alert("Please select a time slot.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isRescheduling && initialData) {
                const reschedulePayload = {
                    new_availability_id: parseInt(formData.availability_id)
                };
                await dispatch(rescheduleAppointment({
                    id: initialData.id,
                    data: reschedulePayload
                })).unwrap();
                alert('Appointment rescheduled successfully!');
            } else {
                const bookingPayload = {
                    patient_id: parseInt(formData.patient_id),
                    doctor_id: parseInt(formData.doctor_id),
                    start_time: availability.find(s => String(s.id) === String(formData.availability_id))?.start_time,
                    end_time: availability.find(s => String(s.id) === String(formData.availability_id))?.end_time,
                    notes: formData.notes,
                    meet_link: visitType === 'Video' ? formData.meet_link : null,
                    availability_id: parseInt(formData.availability_id),
                    booking_type: visitType === 'Video' ? 'online' : 'offline',
                    fee: parseFloat(doctorFee?.fee || 0)
                };
                await dispatch(createAppointment(bookingPayload)).unwrap();
                alert('Appointment booked successfully!');
            }

            dispatch(fetchAppointments());
            dispatch(fetchPatients());
            onClose();
        } catch (err) {
            console.error('Failed to submit appointment:', err);
            const errorMsg = typeof err === 'object' ? JSON.stringify(err) : err;
            alert(`Failed: ${errorMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        {step === 2 && !isRescheduling && (
                            <button onClick={handlePrevStep} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <h3 className="text-lg font-bold text-slate-900">
                            {isRescheduling ? 'Reschedule Appointment' : (step === 1 ? 'Select Patient' : 'Select Date & Time')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                {!isRescheduling && (
                    <div className="h-1 bg-slate-100 w-full flex">
                        <motion.div
                            className="h-full bg-primary-500"
                            initial={{ width: "50%" }}
                            animate={{ width: step === 1 ? "50%" : "100%" }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                )}

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                {/* Patient Select */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient</label>
                                    <div className="relative" ref={patientDropdownRef}>
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                                placeholder="Search by name or phone..."
                                                value={isPatientDropdownOpen ? patientSearch : (selectedPatient?.full_name || patientSearch)}
                                                onFocus={() => setIsPatientDropdownOpen(true)}
                                                onChange={(e) => {
                                                    setPatientSearch(e.target.value);
                                                    setIsPatientDropdownOpen(true);
                                                }}
                                            />
                                        </div>

                                        <AnimatePresence>
                                            {isPatientDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className="absolute z-[100] w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-64 flex flex-col"
                                                >
                                                    <div className="overflow-y-auto p-2 custom-scrollbar">
                                                        {filteredPatients.length > 0 ? (
                                                            filteredPatients.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handlePatientChange(p.id);
                                                                        setPatientSearch(p.full_name);
                                                                        setIsPatientDropdownOpen(false);
                                                                    }}
                                                                    className={cn(
                                                                        "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left mb-1 last:mb-0",
                                                                        String(formData.patient_id) === String(p.id)
                                                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                                                                            : "hover:bg-indigo-50 text-slate-700"
                                                                    )}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-sm tracking-tight">{p.full_name}</span>
                                                                        <div className="flex items-center gap-2 mt-1 opacity-80">
                                                                            <Phone size={10} />
                                                                            <span className="text-[10px] font-medium leading-none tabular-nums">{p.contact_number || 'N/A'}</span>
                                                                        </div>
                                                                    </div>
                                                                    {String(formData.patient_id) === String(p.id) && (
                                                                        <Check size={16} className="text-white" />
                                                                    )}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-4 py-8 text-center bg-slate-50/50 rounded-xl">
                                                                <User className="mx-auto text-slate-300 mb-2" size={24} />
                                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No patients found</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Doctor Select */}
                                {doctors.length > 1 && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Practitioner</label>
                                        <div className="relative group">
                                            <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                            <select
                                                required
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                                                value={formData.doctor_id}
                                                onChange={(e) => setFormData(prev => ({ ...prev, doctor_id: e.target.value }))}
                                            >
                                                <option value="">Select Practitioner</option>
                                                {doctors.map(d => (
                                                    <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
                                        </div>
                                    </div>
                                )}

                                {doctors.length === 0 && !doctorOverride && (
                                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-600">
                                        <AlertCircle size={20} className="shrink-0" />
                                        <div className="text-xs font-bold">
                                            No practitioners assigned to you. Please contact your administrator to assign practitioners.
                                        </div>
                                    </div>
                                )}

                                {/* Doctor Card Preview */}
                                <AnimatePresence>
                                    {selectedDoctor && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-white to-blue-50 border border-blue-100 shadow-sm relative overflow-hidden"
                                        >
                                            <div className="flex items-start gap-4 z-10 relative">
                                                <div className="h-16 w-16 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shadow-inner shrink-0">
                                                    {selectedDoctor.full_name?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-lg text-slate-900 truncate">Pr. {selectedDoctor.full_name}</h4>
                                                    <p className="text-sm text-slate-500 truncate font-medium">{selectedDoctor.role === 'DOCTOR' ? 'Practitioner' : ''}</p>
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                                        <span>{selectedDoctor.metadata || 'Professional Practitioner'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-blue-100/50 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-400 font-medium">Location</span>
                                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                        <MapPin size={12} className="text-primary-500" />
                                                        Hospital Visit
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs text-slate-400 font-medium">Fee</span>
                                                    <span className="text-sm font-bold text-slate-900">₹{doctorFee?.fee || '0'}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                {/* Mini Header */}
                                {selectedDoctor && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-primary-600 font-bold text-sm">
                                            {selectedDoctor.full_name?.[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-900">Pr. {selectedDoctor.full_name}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Visit Type Toggle */}
                                <div className="flex p-1 rounded-xl bg-slate-100/80">
                                    <button
                                        onClick={() => setVisitType('Hospital')}
                                        className={cn(
                                            "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                                            visitType === 'Hospital' ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <Building size={16} />
                                        Hospital Visit
                                    </button>
                                    <button
                                        onClick={() => setVisitType('Video')}
                                        className={cn(
                                            "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                                            visitType === 'Video' ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <Video size={16} />
                                        Video Consult
                                    </button>
                                </div>

                                {/* Date Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Date</label>
                                        <div className="flex items-center gap-2 relative">
                                            <span className="text-xs font-bold text-primary-600">
                                                {new Date(formData.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                            </span>
                                            <button
                                                onClick={() => document.getElementById('modal-date-picker').showPicker()}
                                                className="p-1.5 bg-primary-50 text-primary-600 rounded-lg"
                                            >
                                                <CalendarIcon size={14} />
                                            </button>
                                            <input
                                                id="modal-date-picker"
                                                type="date"
                                                className="sr-only"
                                                value={formData.date}
                                                min={new Date().toISOString().split('T')[0]}
                                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value, time: '', availability_id: '' }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 custom-scrollbar">
                                        {availableDates.map((item) => {
                                            const isSelected = formData.date === item.fullDate;
                                            return (
                                                <button
                                                    key={item.fullDate}
                                                    onClick={() => setFormData(prev => ({ ...prev, date: item.fullDate, time: '', availability_id: '' }))}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-2xl border transition-all shrink-0",
                                                        isSelected
                                                            ? "bg-primary-600 text-white border-primary-600 shadow-md ring-2 ring-primary-200"
                                                            : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <span className={cn("text-[10px] font-medium uppercase", isSelected ? "text-primary-100" : "text-slate-400")}>{item.dayName}</span>
                                                    <span className="text-xl font-bold">{item.dayNumber}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Time Selection */}
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Time</label>
                                    
                                    {timeSlots.morning.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                <span>Morning</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {timeSlots.morning.map(slot => (
                                                    <TimeSlotButton
                                                        key={slot.id}
                                                        slot={slot}
                                                        selectedSlotId={formData.availability_id}
                                                        onClick={(s) => setFormData(prev => ({ ...prev, time: s.time, availability_id: s.id }))}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {timeSlots.afternoon.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                <span>Afternoon</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {timeSlots.afternoon.map(slot => (
                                                    <TimeSlotButton
                                                        key={slot.id}
                                                        slot={slot}
                                                        selectedSlotId={formData.availability_id}
                                                        onClick={(s) => setFormData(prev => ({ ...prev, time: s.time, availability_id: s.id }))}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {timeSlots.evening.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span>Evening</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {timeSlots.evening.map(slot => (
                                                    <TimeSlotButton
                                                        key={slot.id}
                                                        slot={slot}
                                                        selectedSlotId={formData.availability_id}
                                                        onClick={(s) => setFormData(prev => ({ ...prev, time: s.time, availability_id: s.id }))}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {timeSlots.morning.length === 0 && timeSlots.afternoon.length === 0 && timeSlots.evening.length === 0 && (
                                        <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                                            <p className="text-sm font-semibold text-slate-500">No time slots available for this date.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                                    <textarea
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 resize-none"
                                        rows="2"
                                        placeholder="Reason for visit..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    ></textarea>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-white flex justify-between items-center">
                    {step === 1 ? (
                        <button
                            onClick={handleNextStep}
                            disabled={!formData.patient_id || !formData.doctor_id}
                            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                        >
                            <span>Next Step</span>
                            <ChevronRight size={20} />
                        </button>
                    ) : (
                        <div className="flex items-center justify-between w-full gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Consultation Fee</span>
                                <span className="text-xl font-bold text-slate-900">₹{doctorFee?.fee || '0'}</span>
                            </div>
                            <button
                                onClick={handleSubmitAppointment}
                                disabled={isSubmitting || !formData.date || !formData.availability_id}
                                className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>{isRescheduling ? 'Rescheduling...' : 'Confirming...'}</span>
                                    </>
                                ) : (
                                    <span>{isRescheduling ? 'Confirm Reschedule' : 'Confirm Booking'}</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
