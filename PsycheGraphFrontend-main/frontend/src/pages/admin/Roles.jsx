import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock } from 'lucide-react';


export default function Roles() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-800">Roles & Permissions</h1>
                <p className="text-slate-500">Manage access levels and security groups</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm"
            >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <Shield size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Roles Module Under Development</h3>
                <p className="text-slate-500 max-w-md mb-8">
                    We are currently building the comprehensive role-based access control system to give you finer control over clinic operations.
                </p>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg text-slate-500 text-sm font-medium border border-slate-100">
                    <Lock size={14} />
                    Secure Module
                </div>
            </motion.div>
        </div>
    );
}
