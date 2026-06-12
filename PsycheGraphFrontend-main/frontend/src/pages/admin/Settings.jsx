import React from 'react';
import { motion } from 'framer-motion';
import { Settings, ShieldCheck } from 'lucide-react';

export default function AdminSettings() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-800">Admin Settings</h1>
                <p className="text-slate-500">Platform-wide preferences and security configurations</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm"
            >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <Settings size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">System Preferences</h3>
                <p className="text-slate-500 max-w-md mb-8">
                    Manage API integrations, data export formats, and security defaults like Two-Factor Authentication (2FA) for your staff.
                </p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                    <div className="h-10 bg-slate-50 border border-slate-100 rounded-xl" />
                    <div className="h-10 bg-slate-50 border border-slate-100 rounded-xl" />
                </div>
            </motion.div>
        </div>
    );
}

