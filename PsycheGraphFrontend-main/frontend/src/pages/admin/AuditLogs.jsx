import React from 'react';
import { motion } from 'framer-motion';
import { FileSignature, Search } from 'lucide-react';


export default function AuditLogs() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-800">Audit Logs (Read-only)</h1>
                <p className="text-slate-500">Immutable record of all critical system changes</p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm"
            >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <FileSignature size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Compliance & Security</h3>
                <p className="text-slate-500 max-w-md mb-8">
                    Review every administrative change, permission update, and data export in a read-only log for full clinical accountability.
                </p>
                <div className="w-full max-w-sm p-4 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="h-2 w-1/2 bg-slate-200 rounded mb-2" />
                    <div className="h-2 w-full bg-slate-100 rounded" />
                </div>
            </motion.div>
        </div>
    );
}
