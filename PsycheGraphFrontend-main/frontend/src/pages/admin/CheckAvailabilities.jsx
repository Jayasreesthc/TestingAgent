import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import {
    Clock,
    Calendar,
    AlertCircle,
    Loader2,
    ChevronRight,
    Stethoscope,
    Trash2,
    Settings,
} from 'lucide-react';
import DoctorManageModal from './DoctorManageModal';
import DoctorService from '../../services/DoctorService';
import AppointmentService from '../../services/AppointmentService';
import { fetchDoctors } from '../../store/slices/AllUserSlice';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function AdminCheckAvailabilities() {
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: users, loading: loadingUsers } = useSelector((state) => state.users);
    
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [availabilities, setAvailabilities] = useState([]);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    });

    // Fetch doctors on mount to ensure we have the full list
    useEffect(() => {
        dispatch(fetchDoctors());
    }, [dispatch]);

    // Derived list of all practitioners in the organization
    const doctors = useMemo(() => {
        return users
            .filter(u => (u.role === 'DOCTOR' || u.is_doctor))
            .map(u => ({
                id: String(u.id || u.user_id),
                full_name: u.full_name || u.name || "Unknown Practitioner",
            }));
    }, [users]);

    // Auto-select if only one doctor exists
    useEffect(() => {
        if (doctors.length === 1 && !selectedDoctorId) {
            setSelectedDoctorId(doctors[0].id);
        }
    }, [doctors, selectedDoctorId]);

    const fetchDetailedAvailability = async () => {
        if (!selectedDoctorId) return;
        setLoadingSlots(true);
        try {
            const params = {
                doctor_id: selectedDoctorId,
                organization_id: currentUser?.organization_id || currentUser?.user?.organization_id,
                start_date: startDate,
                end_date: endDate,
                only_available: false 
            };
            const data = await AppointmentService.fetchAvailability(params);
            setAvailabilities(data || []);
        } catch (err) {
            console.error("Failed to fetch detailed availability:", err);
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleDeleteSlot = async (slotId) => {
        if (!window.confirm('Are you sure you want to delete this availability slot?')) return;
        
        try {
            await AppointmentService.deleteAvailability(slotId);
            // Refresh slots
            fetchDetailedAvailability();
        } catch (err) {
            console.error("Failed to delete slot:", err);
            alert("Delete action failed. Please try again.");
        }
    };

    useEffect(() => {
        if (selectedDoctorId) {
            fetchDetailedAvailability();
        } else {
            setAvailabilities([]);
        }
    }, [selectedDoctorId, startDate, endDate]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 md:px-0">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black text-[#012939] tracking-tight">
                        Check <span className="text-primary-500">Availabilities</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs mt-2 flex items-center gap-2">
                        <div className="w-8 h-[2px] bg-primary-500" />
                        Cross-reference real-time slots & weekly schedules
                    </p>
                </div>

                <AnimatePresence>
                    {selectedDoctorId && (
                        <motion.button 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onClick={() => setIsManageModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-xl shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2 shrink-0"
                            title="Manage Doctor Schedule & Availability"
                        >
                            <Settings size={18} />
                            Manage Availability
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Simplified Control Bar */}
            <div className="mb-8">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center gap-4 lg:gap-6">
                    {/* Doctor Selector */}
                    <div className="lg:flex-[1.5] min-w-0">
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                                <Stethoscope size={18} />
                            </div>
                            <select
                                value={selectedDoctorId}
                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 transition-all appearance-none"
                            >
                                <option value="">Select Practitioner...</option>
                                {doctors.map(doc => (
                                    <option key={doc.id} value={doc.id}>Dr. {doc.full_name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <ChevronRight size={16} className="rotate-90" />
                            </div>
                        </div>
                    </div>

                    {/* Date Range Controls */}
                    <div className="lg:flex-[2.5] flex flex-col md:flex-row items-stretch md:items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="flex flex-col gap-1.5 flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Start Date</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-primary-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="text-slate-300 mt-6 hidden md:block shrink-0">
                                <ChevronRight size={14} />
                            </div>
                            <div className="flex flex-col gap-1.5 flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">End Date</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-primary-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={fetchDetailedAvailability}
                            disabled={loadingSlots || !selectedDoctorId}
                            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 text-white px-8 py-3 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 disabled:cursor-not-allowed shrink-0 mt-auto lg:mt-6"
                        >
                            {loadingSlots ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                            Sync Slots
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                {doctors.length === 0 && !loadingUsers ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white rounded-[3rem] border border-slate-100 p-16 text-center shadow-xl shadow-slate-100/50"
                    >
                        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-rose-50/50">
                            <AlertCircle size={48} />
                        </div>
                        <h3 className="text-3xl font-black text-[#012939] tracking-tight">No Practitioners Found</h3>
                        <p className="text-slate-500 font-medium max-w-md mx-auto mt-4 leading-relaxed">
                            No practitioners were found for your organization. Please ensure practitioners are registered and active.
                        </p>
                    </motion.div>
                ) : !selectedDoctorId ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-20 flex flex-col items-center justify-center text-center space-y-6"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary-100 rounded-full blur-3xl opacity-30 animate-pulse" />
                            <div className="relative w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-50">
                                <Stethoscope size={64} className="text-primary-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-[#012939]">Welcome, {currentUser?.full_name?.split(' ')[0] || 'Admin'}</h3>
                            <p className="text-slate-400 font-medium">Please select a practitioner to begin verification of availability.</p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        key={selectedDoctorId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-8"
                    >
                        {/* Real-time Slots Visualization */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-2xl font-black text-[#012939] flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <Clock size={22} />
                                    </div>
                                    Real-time Availability
                                </h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live Status
                                    </div>
                                </div>
                            </div>

                            {loadingSlots ? (
                                <div className="bg-white rounded-[3rem] border border-slate-100 p-24 flex flex-col items-center justify-center gap-6 shadow-sm">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-primary-50 rounded-full scale-150 blur-2xl animate-pulse" />
                                        <Loader2 className="w-12 h-12 text-primary-500 animate-spin relative z-10" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[#012939] font-black text-lg">Synchronizing Slots...</p>
                                        <p className="text-slate-400 font-medium text-sm mt-1">Cross-referencing appointment database</p>
                                    </div>
                                </div>
                            ) : availabilities.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {Object.entries(availabilities.reduce((acc, slot) => {
                                        const date = slot.start_time.split(' ')[0];
                                        if (!acc[date]) acc[date] = [];
                                        acc[date].push(slot);
                                        return acc;
                                    }, {})).sort(([a], [b]) => new Date(a) - new Date(b)).map(([date, slots], idx) => (
                                        <motion.div 
                                            key={date}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-2 transition-all duration-500"
                                        >
                                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between group-hover:bg-[#012939] transition-colors duration-500">
                                                <div className="space-y-0.5">
                                                    <h4 className="text-sm font-black text-[#012939] group-hover:text-white transition-colors">
                                                        {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                                    </h4>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary-300 transition-colors">
                                                        {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
                                                    </p>
                                                </div>
                                                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-primary-500 transition-colors">
                                                    <Calendar size={18} className="text-primary-500 group-hover:text-white transition-colors" />
                                                </div>
                                            </div>
                                            
                                            <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {slots.map((slot) => {
                                                    const time = new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    return (
                                                        <div 
                                                            key={slot.id} 
                                                            className={cn(
                                                                "group/slot flex items-center justify-between p-3.5 rounded-2xl border transition-all relative overflow-hidden",
                                                                slot.is_booked 
                                                                    ? "bg-rose-50/30 border-rose-100/50 grayscale-[0.5]" 
                                                                    : "bg-white border-slate-100 hover:border-primary-500 hover:ring-2 hover:ring-primary-500/10"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3 relative z-10">
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                                                                    slot.is_booked ? "bg-rose-100 text-rose-500" : "bg-primary-50 text-primary-500 group-hover/slot:bg-primary-500 group-hover/slot:text-white"
                                                                )}>
                                                                    <Clock size={16} />
                                                                </div>
                                                                <span className={cn("text-xs font-black tracking-tight", slot.is_booked ? "text-rose-600 line-through opacity-60" : "text-[#012939]")}>
                                                                    {time}
                                                                </span>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteSlot(slot.id);
                                                                    }}
                                                                    className="ml-2 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Delete Slot"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                            <div className={cn(
                                                                "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest relative z-10",
                                                                slot.is_booked ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover/slot:bg-emerald-500 group-hover/slot:text-white group-hover/slot:border-emerald-400"
                                                            )}>
                                                                {slot.is_booked ? "Booked" : "Open"}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{slots.length} Total slots configured</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-100 p-20 text-center space-y-4">
                                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <AlertCircle size={40} />
                                    </div>
                                    <h4 className="text-xl font-black text-[#012939]">No Slots Generated</h4>
                                    <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm">No availability slots have been generated for this practitioner during the selected period.</p>
                                </div>
                            )}
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>

            <DoctorManageModal
                isOpen={isManageModalOpen}
                onClose={() => {
                    setIsManageModalOpen(false);
                    fetchDetailedAvailability(); // Refresh slots after managing
                }}
                doctorId={selectedDoctorId}
                doctorName={doctors.find(d => String(d.id) === String(selectedDoctorId))?.full_name}
            />
        </div>
    );
}
