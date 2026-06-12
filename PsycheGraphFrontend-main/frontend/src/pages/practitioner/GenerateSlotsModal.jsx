import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Sparkles,
    Calendar,
    Clock,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Wallet
} from 'lucide-react';
import PractitionerService from '../../services/PractitionerService';

export default function GenerateSlotsModal({ isOpen, onClose, practitionerId }) {
    const [formData, setFormData] = useState({
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        duration_minutes: 30,
        fee: ''
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingFee, setIsLoadingFee] = useState(false);
    const [hasExistingFee, setHasExistingFee] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    React.useEffect(() => {
        if (isOpen && practitionerId) {
            fetchFee();
        }
    }, [isOpen, practitionerId]);

    const fetchFee = async () => {
        setIsLoadingFee(true);
        try {
            const data = await PractitionerService.getPractitionerFee(practitionerId);
            if (data && data.amount) {
                setFormData(prev => ({ ...prev, fee: data.amount }));
                setHasExistingFee(true);
            }
        } catch (err) {
            console.error("Failed to fetch fee:", err);
        } finally {
            setIsLoadingFee(false);
        }
    };

    const handleGenerate = async () => {
        if (!formData.start_date || !formData.end_date || !formData.duration_minutes || !formData.fee) {
            setError('Please provide From/To date, duration, and fee.');
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            // Save Fee first
            const feePayload = { fee: Number(formData.fee) };
            if (hasExistingFee) {
                await PractitionerService.updatePractitionerFee(practitionerId, feePayload);
            } else {
                await PractitionerService.setPractitionerFee(practitionerId, feePayload);
            }

            // Generate Slots
            const generationPayload = {
                start_date: formData.start_date,
                end_date: formData.end_date,
                duration_minutes: formData.duration_minutes
            };
            await PractitionerService.generateAvailabilitySlots(practitionerId, generationPayload);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to generate availability slots. Make sure you have a schedule set for this day.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-[#062f3f]/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#062f3f] leading-none">Generate Slots</h2>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Automatic Scheduling</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-rose-500"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[11px] font-bold flex items-center gap-2"
                                >
                                    <AlertCircle size={14} className="shrink-0" />
                                    {error}
                                </motion.div>
                            )}

                            {success && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-[11px] font-bold flex items-center gap-2"
                                >
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    Slots generated successfully!
                                </motion.div>
                            )}

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <Calendar size={12} /> From Date
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.start_date}
                                            onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <Calendar size={12} /> To Date
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.end_date}
                                            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                            min={formData.start_date || new Date().toISOString().split('T')[0]}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Clock size={12} /> Duration (Minutes)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.duration_minutes}
                                            onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                                            placeholder="e.g. 30"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">Min</div>
                                    </div>
                                    <p className="text-[9px] font-medium text-slate-400 ml-1 mt-1">
                                        Suggested: 15, 30, 45, or 60 minutes
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Wallet size={12} /> Appointment Fee (Mandatory)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            required
                                            value={formData.fee}
                                            onChange={(e) => setFormData(prev => ({ ...prev, fee: e.target.value }))}
                                            placeholder="e.g. 500"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">₹</div>
                                    </div>
                                    {isLoadingFee && (
                                        <p className="text-[9px] font-medium text-indigo-400 ml-1 mt-1 flex items-center gap-1">
                                            <Loader2 size={10} className="animate-spin" /> Fetching current fee...
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex flex-col gap-3">
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || success}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Generating Slots...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        <span>Generate Now</span>
                                    </>
                                )}
                            </button>
                            <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-wider">
                                Slots are created based on your weekly schedule
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
