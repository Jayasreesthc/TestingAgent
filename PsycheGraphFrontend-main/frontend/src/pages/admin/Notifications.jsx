import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail } from 'lucide-react';


export default function Notifications() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-800">Global Notifications</h1>
                <p className="text-slate-500">Configure email and SMS alerts for the organization</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm"
            >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <Bell size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Alert Management</h3>
                <p className="text-slate-500 max-w-md mb-8">
                    Set up automatic appointment reminders, critical system alerts, and staff notifications to keep the clinic running smoothly.
                </p>
                <div className="flex items-center gap-2">
                    <div className="w-10 h-6 bg-indigo-600 rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 font-mono">ENABLED</span>
                </div>
            </motion.div>
        </div>
    );
}
