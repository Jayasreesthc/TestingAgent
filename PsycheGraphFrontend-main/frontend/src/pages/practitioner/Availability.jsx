import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    Clock,
    Calendar,
    Edit3,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Coffee,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import PractitionerService from '../../services/PractitionerService';
import SetAvailabilityModal from './SetAvailabilityModal';
import GenerateSlotsModal from './GenerateSlotsModal';

const DAYS = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

export default function PractitionerAvailability() {
    const { user } = useSelector((state) => state.auth);
    const [schedule, setSchedule] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const practitionerId = user?.id || user?.user?.id;

    const fetchSchedule = async () => {
        if (!practitionerId) return;
        setLoading(true);
        try {
            const data = await PractitionerService.getPractitionerSchedule(practitionerId);
            // Transform array response to object keyed by day
            if (Array.isArray(data)) {
                const formatted = {};
                data.forEach(item => {
                    formatted[item.day.toLowerCase()] = item;
                });
                setSchedule(formatted);
            } else {
                setSchedule(data);
            }
            setError(null);
        } catch (err) {
            setError('Failed to fetch availability schedule');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, [practitionerId]);

    const handleSaveSuccess = () => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        fetchSchedule();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#062f3f] tracking-tight">My Availability</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage your weekly working hours and session slots</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white hover:bg-slate-50 text-indigo-600 rounded-2xl font-black transition-all shadow-sm border border-slate-100 group active:scale-95"
                    >
                        <div className="p-1.5 bg-indigo-50 rounded-lg group-hover:scale-110 transition-transform">
                            <Sparkles size={16} />
                        </div>
                        <span className="text-sm">Batch Generate Slots</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-2.5 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 group active:scale-95"
                    >
                        <div className="p-1.5 bg-white/20 rounded-lg group-hover:rotate-12 transition-transform">
                            <Clock size={16} />
                        </div>
                        <span className="text-sm">Set Availability</span>
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 font-bold"
                    >
                        <CheckCircle2 size={20} />
                        Availability updated successfully!
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                {DAYS.map((day) => {
                    const dayData = schedule?.[day] || { is_enabled: false };
                    const isEnabled = dayData.is_enabled;

                    return (
                        <motion.div
                            key={day}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-6 bg-white rounded-3xl border transition-all ${isEnabled ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60 grayscale-[0.3]'}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-[#062f3f] capitalize">{day}</h3>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                    {isEnabled ? 'Enabled' : 'Disabled'}
                                </div>
                            </div>

                            {isEnabled ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift 1</p>
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                            <Clock size={14} className="text-indigo-500" />
                                            <span>{dayData.start_time_1} - {dayData.end_time_1}</span>
                                        </div>
                                    </div>

                                    {(dayData.break_start || dayData.break_end) && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Break</p>
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                <Coffee size={14} className="text-orange-400" />
                                                <span>{dayData.break_start || '--'} - {dayData.break_end || '--'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {dayData.start_time_2 && dayData.end_time_2 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift 2</p>
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                <Clock size={14} className="text-indigo-500" />
                                                <span>{dayData.start_time_2} - {dayData.end_time_2}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-slate-400 font-bold italic text-sm">
                                    Off Day
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {isModalOpen && (
                <SetAvailabilityModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setShowSuccess(true);
                        fetchSchedule();
                        setTimeout(() => setShowSuccess(false), 3000);
                    }}
                    currentSchedule={schedule}
                    practitionerId={practitionerId}
                />
            )}

            <GenerateSlotsModal
                isOpen={isGenerateModalOpen}
                onClose={() => setIsGenerateModalOpen(false)}
                practitionerId={practitionerId}
            />
        </div>
    );
}
