import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Settings } from 'lucide-react';


export default function ClinicSettings() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-800">Clinic Settings</h1>
                <p className="text-slate-500">Configure your hospital profile and operational details</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm"
            >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <Building2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Clinic Configuration</h3>
                <p className="text-slate-500 max-w-md mb-8">
                    Set up your clinic name, contact information, and logo to personalize the platform for your staff and patients.
                </p>
                <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
                    Coming Soon
                </button>
            </motion.div>
        </div>
    );
}
