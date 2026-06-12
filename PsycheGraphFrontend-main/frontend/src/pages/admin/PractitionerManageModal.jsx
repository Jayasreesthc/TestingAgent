import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, Clock, Coffee, ArrowRight, Loader2, Plus, Trash2,
    Sparkles, Calendar, Wallet, CheckCircle2, AlertCircle
} from 'lucide-react';
import PractitionerService from '../../services/PractitionerService';

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

export default function PractitionerManageModal({ isOpen, onClose, practitionerId, practitionerName }) {
    const [activeTab, setActiveTab] = useState('schedule'); // 'schedule', 'slots', 'fees'
    const [schedule, setSchedule] = useState({});
    const [uiState, setUiState] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Slots state
    const [slotData, setSlotData] = useState({
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        duration_minutes: 30,
        fee: ''
    });

    // Fee state
    const [feeAmount, setFeeAmount] = useState('');
    const [hasExistingFee, setHasExistingFee] = useState(false);

    useEffect(() => {
        if (isOpen && practitionerId) {
            fetchInitialData();
        }
    }, [isOpen, practitionerId]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch Schedule
            const scheduleData = await PractitionerService.getPractitionerSchedule(practitionerId);
            const formattedSchedule = {};
            const initialUi = {};

            const dataMap = Array.isArray(scheduleData)
                ? scheduleData.reduce((acc, curr) => { acc[curr.day.toLowerCase()] = curr; return acc; }, {})
                : (scheduleData || {});

            DAYS.forEach(day => {
                const dayData = dataMap[day.id] || { ...DEFAULT_DAY };
                formattedSchedule[day.id] = dayData;
                initialUi[day.id] = {
                    showBreak: !!(dayData.break_start || dayData.break_end),
                    showShift2: !!(dayData.start_time_2 || dayData.end_time_2)
                };
            });
            setSchedule(formattedSchedule);
            setUiState(initialUi);

            // Fetch Fee
            const feeData = await PractitionerService.getPractitionerFee(practitionerId);
            if (feeData && feeData.amount) {
                setFeeAmount(feeData.amount);
                setSlotData(prev => ({ ...prev, fee: feeData.amount }));
                setHasExistingFee(true);
            } else {
                setFeeAmount('');
                setHasExistingFee(false);
            }
        } catch (err) {
            setError('Failed to load practitioner data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleDay = (dayId) => {
        setSchedule(prev => ({
            ...prev,
            [dayId]: { ...prev[dayId], is_enabled: !prev[dayId].is_enabled }
        }));
    };

    const handleTimeChange = (dayId, field, value) => {
        setSchedule(prev => ({
            ...prev,
            [dayId]: { ...prev[dayId], [field]: value }
        }));
    };

    const toggleUiField = (dayId, field) => {
        setUiState(prev => ({
            ...prev,
            [dayId]: { ...prev[dayId], [field]: !prev[dayId][field] }
        }));
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

    const handleSaveSchedule = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const cleanSchedule = {};
            Object.keys(schedule).forEach(day => {
                const dayData = { ...schedule[day] };
                if (!uiState[day].showBreak) { dayData.break_start = ""; dayData.break_end = ""; }
                if (!uiState[day].showShift2) { dayData.start_time_2 = ""; dayData.end_time_2 = ""; }
                cleanSchedule[day] = dayData;
            });

            await PractitionerService.updatePractitionerSchedule(practitionerId, cleanSchedule);
            setSuccess('Schedule updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update schedule');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveFee = async () => {
        if (!feeAmount) { setError('Please enter a fee amount'); return; }
        setIsSaving(true);
        setError(null);
        try {
            const payload = { fee: Number(feeAmount) };
            if (hasExistingFee) {
                await PractitionerService.updatePractitionerFee(practitionerId, payload);
            } else {
                await PractitionerService.setPractitionerFee(practitionerId, payload);
            }
            setHasExistingFee(true);
            setSlotData(prev => ({ ...prev, fee: feeAmount }));
            setSuccess('Fee updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError('Failed to update fee');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateSlots = async () => {
        if (!slotData.start_date || !slotData.end_date || !slotData.duration_minutes || !slotData.fee) {
            setError('Please provide From/To date, duration, and fee.');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            // Sync fee if changed
            if (Number(slotData.fee) !== Number(feeAmount)) {
                const feePayload = { fee: Number(slotData.fee) };
                if (hasExistingFee) await PractitionerService.updatePractitionerFee(practitionerId, feePayload);
                else await PractitionerService.setPractitionerFee(practitionerId, feePayload);
                setHasExistingFee(true);
                setFeeAmount(slotData.fee);
            }

            await PractitionerService.generateAvailabilitySlots(practitionerId, {
                start_date: slotData.start_date,
                end_date: slotData.end_date,
                duration_minutes: slotData.duration_minutes
            });
            setSuccess('Slots generated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to generate slots. Ensure schedule is set for this day.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

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
                    className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-8 pb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-[#062f3f] tracking-tight">Manage {practitionerName}</h2>
                            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">Practitioner Management Portal</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-slate-50 rounded-2xl transition-all border border-slate-100 text-slate-400 hover:text-rose-500"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="px-8 pb-4 flex items-center gap-6 border-b border-slate-50">
                        {['schedule', 'slots', 'fees'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setError(null); }}
                                className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Notification Overlay */}
                    <AnimatePresence>
                        {(error || success) && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="px-8 pt-4"
                            >
                                <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${error ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                    {error || success}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Fetching Practitioner Details...</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'schedule' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-slate-500">Configure weekly working hours for the practitioner.</p>
                                            <button
                                                onClick={handleSaveSchedule}
                                                disabled={isSaving}
                                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                                            >
                                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                Save Schedule
                                            </button>
                                        </div>
                                        <div className="space-y-4">
                                            {DAYS.map((day) => {
                                                const dayData = schedule[day.id] || DEFAULT_DAY;
                                                const isEnabled = dayData.is_enabled;
                                                const { showBreak, showShift2 } = uiState[day.id] || { showBreak: false, showShift2: false };

                                                return (
                                                    <div key={day.id} className={`p-6 rounded-3xl border transition-all ${isEnabled ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                            <div className="flex items-center gap-4 min-w-[150px]">
                                                                <button
                                                                    onClick={() => handleToggleDay(day.id)}
                                                                    className={`shrink-0 w-12 h-6 rounded-full transition-all relative ${isEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                                >
                                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isEnabled ? 'right-1' : 'left-1'}`} />
                                                                </button>
                                                                <span className="text-sm font-black text-[#062f3f] uppercase tracking-wider">{day.label}</span>
                                                            </div>

                                                            {isEnabled && (
                                                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                    <div className="space-y-2">
                                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift 1</label>
                                                                        <div className="flex items-center gap-2">
                                                                            <input type="time" value={dayData.start_time_1 || ''} onChange={(e) => handleTimeChange(day.id, 'start_time_1', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                                                                            <span className="text-slate-300">-</span>
                                                                            <input type="time" value={dayData.end_time_1 || ''} onChange={(e) => handleTimeChange(day.id, 'end_time_1', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                                                                        </div>
                                                                    </div>

                                                                    {showBreak ? (
                                                                        <div className="space-y-2 relative group">
                                                                            <button onClick={() => toggleUiField(day.id, 'showBreak')} className="absolute -top-1 -right-1 p-1 text-orange-300 hover:text-orange-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                                                                            <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Break Time</label>
                                                                            <div className="flex items-center gap-2 text-orange-600">
                                                                                <input type="time" value={dayData.break_start || ''} onChange={(e) => handleTimeChange(day.id, 'break_start', e.target.value)} className="w-full px-3 py-2 bg-orange-50/50 border border-orange-100 rounded-xl text-xs font-bold outline-none" />
                                                                                <span>-</span>
                                                                                <input type="time" value={dayData.break_end || ''} onChange={(e) => handleTimeChange(day.id, 'break_end', e.target.value)} className="w-full px-3 py-2 bg-orange-50/50 border border-orange-100 rounded-xl text-xs font-bold outline-none" />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => toggleUiField(day.id, 'showBreak')} className="h-full flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors self-end pb-3"><Plus size={12} /> Add Break</button>
                                                                    )}

                                                                    {showShift2 ? (
                                                                        <div className="space-y-2 relative group">
                                                                            <button onClick={() => toggleUiField(day.id, 'showShift2')} className="absolute -top-1 -right-1 p-1 text-indigo-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                                                                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Shift 2</label>
                                                                            <div className="flex items-center gap-2">
                                                                                <input type="time" value={dayData.start_time_2 || ''} onChange={(e) => handleTimeChange(day.id, 'start_time_2', e.target.value)} className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-bold outline-none" />
                                                                                <span>-</span>
                                                                                <input type="time" value={dayData.end_time_2 || ''} onChange={(e) => handleTimeChange(day.id, 'end_time_2', e.target.value)} className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-bold outline-none" />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => toggleUiField(day.id, 'showShift2')} className="h-full flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors self-end pb-3"><Plus size={12} /> Add Shift 2</button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {!isEnabled && <div className="flex-1 text-center text-slate-400 font-bold italic text-sm">Off Day</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'slots' && (
                                    <div className="max-w-xl mx-auto space-y-8 py-4">
                                        <div className="text-center space-y-2">
                                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                                <Sparkles size={32} />
                                            </div>
                                            <h3 className="text-xl font-black text-[#062f3f]">Batch Generate Slots</h3>
                                            <p className="text-sm text-slate-500 font-medium">Create all bookable slots for a specific day based on the weekly schedule.</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                        <Calendar size={14} /> From Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={slotData.start_date}
                                                        onChange={(e) => setSlotData({ ...slotData, start_date: e.target.value })}
                                                        min={new Date().toISOString().split('T')[0]}
                                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                        <Calendar size={14} /> To Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={slotData.end_date}
                                                        onChange={(e) => setSlotData({ ...slotData, end_date: e.target.value })}
                                                        min={slotData.start_date || new Date().toISOString().split('T')[0]}
                                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Clock size={14} /> Duration (Mins)</label>
                                                    <input type="number" value={slotData.duration_minutes} onChange={(e) => setSlotData({ ...slotData, duration_minutes: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Wallet size={14} /> Slot Fee (₹)</label>
                                                    <input type="number" value={slotData.fee} onChange={(e) => setSlotData({ ...slotData, fee: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500" />
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleGenerateSlots}
                                                disabled={isSaving}
                                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
                                            >
                                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                                Generate Availability Slots
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'fees' && (
                                    <div className="max-w-xl mx-auto space-y-8 py-10">
                                        <div className="text-center space-y-2">
                                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                                <Wallet size={32} />
                                            </div>
                                            <h3 className="text-xl font-black text-[#062f3f]">Update Consultation Fee</h3>
                                            <p className="text-sm text-slate-500 font-medium">Set the standard booking amount for this practitioner's appointments.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Base Fee</label>
                                                <div className="relative">
                                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300">₹</div>
                                                    <input
                                                        type="number"
                                                        value={feeAmount}
                                                        onChange={(e) => setFeeAmount(e.target.value)}
                                                        placeholder="e.g. 500"
                                                        className="w-full pl-10 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black outline-none focus:border-emerald-500 transition-all shadow-inner"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleSaveFee}
                                                disabled={isSaving}
                                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                                Confirm New Fee
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
