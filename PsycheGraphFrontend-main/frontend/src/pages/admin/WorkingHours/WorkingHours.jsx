import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { getWorkingHours, setWorkingHours, clearOrgError } from '../../../store/slices/OrgSlice';
import {
    Clock,
    Save,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Calendar,
    Coffee,
    ArrowRight
} from 'lucide-react';

const DAYS = [
    { id: 'monday', label: 'Monday' },
    { id: 'tuesday', label: 'Tuesday' },
    { id: 'wednesday', label: 'Wednesday' },
    { id: 'thursday', label: 'Thursday' },
    { id: 'friday', label: 'Friday' },
    { id: 'saturday', label: 'Saturday' },
    { id: 'sunday', label: 'Sunday' }
];

export default function WorkingHours() {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { workingHours, loading, error } = useSelector((state) => state.organizations);

    const [schedule, setSchedule] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Get org_id from user object - handle both naming conventions
    const orgId = user?.organization_id || user?.user?.organization_id || user?.id || user?.user?.id;

    useEffect(() => {
        if (orgId) {
            dispatch(getWorkingHours(orgId));
        }
        return () => dispatch(clearOrgError());
    }, [dispatch, orgId]);

    useEffect(() => {
        if (workingHours) {
            console.log('Working Hours Response:', workingHours);
            // Handle different data formats (array, object, or nested in .data)
            const rawData = workingHours.data || workingHours;

            if (Array.isArray(rawData) && rawData.length > 0) {
                const formatted = {};
                rawData.forEach(item => {
                    if (item.day) {
                        formatted[item.day.toLowerCase()] = item;
                    }
                });
                setSchedule(formatted);
            } else if (typeof rawData === 'object' && rawData !== null && Object.keys(rawData).length > 0 && !rawData.message) {
                // If it's a direct object and not a success message
                setSchedule(rawData);
            }
        } else if (!loading) {
            // Initialize with default values if none exist from server
            const initial = {};
            DAYS.forEach(day => {
                initial[day.id] = {
                    is_enabled: true,
                    start_time: '09:00',
                    end_time: '17:00',
                    break_start: '13:00',
                    break_end: '14:00'
                };
            });
            setSchedule(initial);
        }
    }, [workingHours, loading]);

    const handleToggleDay = (dayId) => {
        setSchedule(prev => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                is_enabled: !prev[dayId]?.is_enabled
            }
        }));
    };

    const handleTimeChange = (dayId, field, value) => {
        setSchedule(prev => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (!orgId) {
            console.error("No Organization ID found");
            return;
        }
        setIsSaving(true);
        try {
            await dispatch(setWorkingHours({ org_id: orgId, data: schedule })).unwrap();

            // Re-fetch to ensure we have the latest state from the server
            await dispatch(getWorkingHours(orgId)).unwrap();

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save working hours:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-180px)] max-w-[1200px] mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col gap-1 px-1 mb-8">
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Working Hours</h1>
                <p className="text-[13px] text-slate-400 font-medium tracking-tight uppercase">Set your clinic's weekly operational schedule</p>
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-4 text-red-600 text-sm mb-6 shadow-sm shadow-red-50"
                    >
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Error Updating Schedule</p>
                            <p className="font-medium opacity-90">{typeof error === 'string' ? error : (error.msg || JSON.stringify(error))}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Schedule Grid */}
            <div className="grid grid-cols-1 gap-4">
                {DAYS.map((day, index) => {
                    const dayData = schedule[day.id] || { is_enabled: false, start_time: '09:00', end_time: '17:00' };
                    const isEnabled = dayData.is_enabled;

                    return (
                        <motion.div
                            key={day.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isEnabled ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60 grayscale-[0.5]'}`}
                        >
                            <div className="p-5 flex flex-col md:flex-row md:items-center gap-6">
                                {/* Day Info & Toggle */}
                                <div className="flex items-center gap-4 min-w-[180px]">
                                    <button
                                        onClick={() => handleToggleDay(day.id)}
                                        className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${isEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isEnabled ? 'left-7' : 'left-1'}`} />
                                    </button>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-wider">{day.label}</p>
                                        <p className={`text-[11px] font-bold ${isEnabled ? 'text-indigo-500' : 'text-slate-400'}`}>
                                            {isEnabled ? 'OPEN FOR BUSINESS' : 'CLOSED'}
                                        </p>
                                    </div>
                                </div>

                                {isEnabled ? (
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                                        {/* Working Hours */}
                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                <Clock size={12} /> Shift Start
                                            </label>
                                            <input
                                                type="time"
                                                value={dayData.start_time}
                                                onChange={(e) => handleTimeChange(day.id, 'start_time', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                <ArrowRight size={12} /> Shift End
                                            </label>
                                            <input
                                                type="time"
                                                value={dayData.end_time}
                                                onChange={(e) => handleTimeChange(day.id, 'end_time', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700"
                                            />
                                        </div>

                                        {/* Break Time */}
                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                <Coffee size={12} /> Break Start
                                            </label>
                                            <input
                                                type="time"
                                                value={dayData.break_start || ''}
                                                onChange={(e) => handleTimeChange(day.id, 'break_start', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-indigo-50/30 border border-indigo-100/50 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                <Coffee size={12} /> Break End
                                            </label>
                                            <input
                                                type="time"
                                                value={dayData.break_end || ''}
                                                onChange={(e) => handleTimeChange(day.id, 'break_end', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-indigo-50/30 border border-indigo-100/50 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                                        <p className="text-sm font-bold text-slate-400 italic tracking-tight">Clinic is officially closed on this day</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Action Bar */}
            <div className="mt-auto pt-10 flex items-center justify-between py-8 border-t border-slate-100">
                <div className="flex items-center gap-4 text-slate-400">
                    <div className="p-2 bg-slate-50 rounded-lg">
                        <Calendar size={18} />
                    </div>
                    <p className="text-[13px] font-medium max-w-xs leading-tight">These settings directly impact your appointment availability and clinic operational status.</p>
                </div>

                <div className="flex items-center gap-4">
                    <AnimatePresence>
                        {showSuccess && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="px-6 py-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100 flex items-center gap-3 font-black text-[13px]"
                            >
                                <CheckCircle2 size={18} />
                                CHANGES SAVED
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || loading}
                        className={`group relative px-10 py-4 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 flex items-center gap-3 overflow-hidden ${isSaving || loading ? 'bg-slate-800 cursor-not-allowed shadow-none' : 'bg-indigo-600 shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5'}`}
                    >
                        {(isSaving || loading) ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} className="transition-transform group-hover:scale-110" />
                        )}
                        <span>{(isSaving || loading) ? "SAVING..." : "SAVE CHANGES"}</span>

                        {(isSaving || loading) && (
                            <motion.div
                                className="absolute bottom-0 left-0 h-1 bg-indigo-400"
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 1.5 }}
                            />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
