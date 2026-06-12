import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Save,
    Clock,
    Coffee,
    ArrowRight,
    Loader2,
    Plus,
    Trash2
} from 'lucide-react';
import DoctorService from '../../services/DoctorService';

const DAYS = [
    { id: 'monday', label: 'Monday' },
    { id: 'tuesday', label: 'Tuesday' },
    { id: 'wednesday', label: 'Wednesday' },
    { id: 'thursday', label: 'Thursday' },
    { id: 'friday', label: 'Friday' },
    { id: 'saturday', label: 'Saturday' },
    { id: 'sunday', label: 'Sunday' }
];

const DEFAULT_DAY = {
    is_enabled: false,
    start_time_1: '09:00',
    end_time_1: '13:00',
    break_start: '13:00',
    break_end: '14:00',
    start_time_2: '14:00',
    end_time_2: '18:00'
};

export default function SetAvailabilityModal({ isOpen, onClose, onSuccess, currentSchedule, doctorId }) {
    const [schedule, setSchedule] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Track which days have Shift 2 or Break visible
    const [uiState, setUiState] = useState({});

    useEffect(() => {
        const initial = {};
        const initialUi = {};

        // Handle both array and object responses
        const scheduleData = Array.isArray(currentSchedule)
            ? currentSchedule.reduce((acc, curr) => {
                acc[curr.day.toLowerCase()] = curr;
                return acc;
            }, {})
            : (currentSchedule || {});

        DAYS.forEach(day => {
            const dayData = scheduleData[day.id] || { ...DEFAULT_DAY };
            initial[day.id] = dayData;

            // Show fields if they have data
            initialUi[day.id] = {
                showBreak: !!(dayData.break_start || dayData.break_end),
                showShift2: !!(dayData.start_time_2 || dayData.end_time_2)
            };
        });
        setSchedule(initial);
        setUiState(initialUi);
    }, [currentSchedule]);

    const handleToggleDay = (dayId) => {
        setSchedule(prev => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                is_enabled: !prev[dayId].is_enabled
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

    const toggleUiField = (dayId, field) => {
        setUiState(prev => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                [field]: !prev[dayId][field]
            }
        }));

        // If hiding, clear the values
        if (uiState[dayId][field]) {
            if (field === 'showBreak') {
                handleTimeChange(dayId, 'break_start', '');
                handleTimeChange(dayId, 'break_end', '');
            } else if (field === 'showShift2') {
                handleTimeChange(dayId, 'start_time_2', '');
                handleTimeChange(dayId, 'end_time_2', '');
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            // Validation: Shift 1 is mandatory if a day is enabled
            const errors = [];
            DAYS.forEach(day => {
                const dayData = schedule[day.id];
                if (dayData.is_enabled) {
                    if (!dayData.start_time_1 || !dayData.end_time_1) {
                        errors.push(`${day.label}: Shift 1 start and end times are mandatory.`);
                    }
                }
            });

            if (errors.length > 0) {
                setError(errors[0]); // Show first error for simplicity
                setIsSaving(false);
                return;
            }

            // Clean payload: ensure blank values are sent as empty strings correctly
            const cleanSchedule = {};
            Object.keys(schedule).forEach(day => {
                const dayData = { ...schedule[day] };

                // If UI fields are hidden, ensure they are empty in payload
                if (!uiState[day].showBreak) {
                    dayData.break_start = "";
                    dayData.break_end = "";
                }
                if (!uiState[day].showShift2) {
                    dayData.start_time_2 = "";
                    dayData.end_time_2 = "";
                }

                cleanSchedule[day] = dayData;
            });

            await DoctorService.updateDoctorSchedule(doctorId, cleanSchedule);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update availability');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-[#062f3f]/80 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-[calc(100%-2rem)] md:w-full max-w-4xl bg-slate-50 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-5 md:p-8 pb-3 md:pb-4 flex items-center justify-between border-b border-slate-100 md:border-none">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-[#062f3f] tracking-tight">Set Your Availability</h2>
                            <p className="text-[10px] md:text-sm font-bold text-slate-400 mt-0.5 md:mt-1 uppercase tracking-widest">Configuration Panel</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 md:p-3 hover:bg-white rounded-xl md:rounded-2xl transition-all border border-slate-100 text-slate-400 hover:text-rose-500"
                        >
                            <X size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 md:pb-8 space-y-4 custom-scrollbar">
                        {error && (
                            <div className="p-3 md:p-4 bg-rose-50 border border-rose-100 rounded-xl md:rounded-2xl text-rose-600 text-xs md:text-sm font-bold flex items-center gap-2 md:gap-3">
                                <X size={16} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {DAYS.map((day) => {
                                const dayData = schedule[day.id] || DEFAULT_DAY;
                                const isEnabled = dayData.is_enabled;
                                const { showBreak, showShift2 } = uiState[day.id] || { showBreak: false, showShift2: false };

                                return (
                                    <div
                                        key={day.id}
                                        className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all ${isEnabled ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-100/50 border-transparent opacity-60'}`}
                                    >
                                        <div className="flex flex-col gap-6">
                                            {/* Day Header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => handleToggleDay(day.id)}
                                                        className={`shrink-0 w-14 h-7 rounded-full transition-all relative ${isEnabled ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 ${isEnabled ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                    <div>
                                                        <p className="text-sm font-black text-[#062f3f] uppercase tracking-wider">{day.label}</p>
                                                        <p className={`text-[10px] font-bold ${isEnabled ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                            {isEnabled ? 'OPEN FOR SESSIONS' : 'NOT AVAILABLE'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {isEnabled && (
                                                    <div className="flex items-center gap-2">
                                                        {!showBreak && (
                                                            <button
                                                                onClick={() => toggleUiField(day.id, 'showBreak')}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-orange-100 transition-colors"
                                                            >
                                                                <Plus size={12} /> Add Break
                                                            </button>
                                                        )}
                                                        {!showShift2 && (
                                                            <button
                                                                onClick={() => toggleUiField(day.id, 'showShift2')}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                                                            >
                                                                <Plus size={12} /> Add Shift 2
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Time Inputs Group */}
                                            {isEnabled && (
                                                <div className="space-y-4">
                                                    {/* Shift 1 */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                                        <div className="space-y-1.5 col-span-1 lg:col-span-2">
                                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                Shift 01
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                                                <Clock size={10} /> Start
                                                            </label>
                                                            <input
                                                                type="time"
                                                                value={dayData.start_time_1 || ''}
                                                                onChange={(e) => handleTimeChange(day.id, 'start_time_1', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                                                <ArrowRight size={10} /> End
                                                            </label>
                                                            <input
                                                                type="time"
                                                                value={dayData.end_time_1 || ''}
                                                                onChange={(e) => handleTimeChange(day.id, 'end_time_1', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Break */}
                                                    {showBreak && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-orange-50/30 p-4 rounded-2xl border border-orange-100/30 relative group/break"
                                                        >
                                                            <button
                                                                onClick={() => toggleUiField(day.id, 'showBreak')}
                                                                className="absolute top-2 right-2 p-1.5 text-orange-300 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all opacity-0 group-hover/break:opacity-100"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <div className="space-y-1.5 col-span-1 lg:col-span-2">
                                                                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                                                    <Coffee size={12} />
                                                                    Scheduled Break
                                                                </p>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                                                    Start
                                                                </label>
                                                                <input
                                                                    type="time"
                                                                    value={dayData.break_start || ''}
                                                                    onChange={(e) => handleTimeChange(day.id, 'break_start', e.target.value)}
                                                                    className="w-full px-3 py-2 bg-white border border-orange-100/50 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-300 transition-all shadow-sm text-orange-700"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                                                    End
                                                                </label>
                                                                <input
                                                                    type="time"
                                                                    value={dayData.break_end || ''}
                                                                    onChange={(e) => handleTimeChange(day.id, 'break_end', e.target.value)}
                                                                    className="w-full px-3 py-2 bg-white border border-orange-100/50 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-300 transition-all shadow-sm text-orange-700"
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {/* Shift 2 */}
                                                    {showShift2 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/30 relative group/shift2"
                                                        >
                                                            <button
                                                                onClick={() => toggleUiField(day.id, 'showShift2')}
                                                                className="absolute top-2 right-2 p-1.5 text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover/shift2:opacity-100"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <div className="space-y-1.5 col-span-1 lg:col-span-2">
                                                                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                    Shift 02
                                                                </p>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                                                    Start
                                                                </label>
                                                                <input
                                                                    type="time"
                                                                    value={dayData.start_time_2 || ''}
                                                                    onChange={(e) => handleTimeChange(day.id, 'start_time_2', e.target.value)}
                                                                    className="w-full px-3 py-2 bg-white border border-indigo-100/50 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all shadow-sm text-indigo-700"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                                                    End
                                                                </label>
                                                                <input
                                                                    type="time"
                                                                    value={dayData.end_time_2 || ''}
                                                                    onChange={(e) => handleTimeChange(day.id, 'end_time_2', e.target.value)}
                                                                    className="w-full px-3 py-2 bg-white border border-indigo-100/50 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all shadow-sm text-indigo-700"
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 md:p-8 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 max-w-sm text-center md:text-left">Changes will be applied immediately to your booking calendar.</p>
                        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                            <button
                                onClick={onClose}
                                className="flex-1 md:flex-none px-6 md:px-8 py-2.5 md:py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl font-bold transition-all border border-slate-200 text-sm md:text-base"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 md:px-10 py-2.5 md:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl md:rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 text-sm md:text-base"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>Save Changes</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
