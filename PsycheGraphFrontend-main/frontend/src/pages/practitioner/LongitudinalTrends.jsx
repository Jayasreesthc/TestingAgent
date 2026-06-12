import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import { CheckCircle2 } from 'lucide-react';
import { fetchPatients } from '../../store/slices/PatientSlice';

// Mock Data
const moodData = [
    { name: 'Jan', value: 5 },
    { name: 'Feb', value: 6 },
    { name: 'Mar', value: 7.5 },
    { name: 'Apr', value: 9 },
];

const symptomData = [
    { name: 'Jan', anxiety: 8.5, depression: 6.8 },
    { name: 'Feb', anxiety: 6.5, depression: 4.8 },
    { name: 'Mar', anxiety: 8.2, depression: 5.5 },
    { name: 'Apr', anxiety: 6.2, depression: 4.2 },
    { name: '', anxiety: 5.5, depression: 3.2 },
    { name: '', anxiety: 5.2, depression: 3 },
    { name: '', anxiety: 4.5, depression: 2.5 }, // More points matching the UI tail off
];


const attendanceData = [
    { name: 'Jan', attended: 8.5, missed: 7, canceled: 5.5 },
    { name: 'Feb', attended: 7.5, missed: 6.5, canceled: 5 },
    { name: 'Mar', attended: 6.5, missed: 4.5, canceled: 0 },
];

export default function LongitudinalTrends() {
    const dispatch = useDispatch();
    const { list: patients } = useSelector((state) => state.patients);
    const [selectedPatient, setSelectedPatient] = useState('');

    useEffect(() => {
        dispatch(fetchPatients());
    }, [dispatch]);

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20 px-4 pt-4">

            {/* Header / Filter */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-bold text-[#2a3547]">Longitudinal Trends</h1>
                    <div className="w-5 h-5 rounded-full bg-[#e8f0fe] flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-[#3b82f6]" strokeWidth={3} />
                    </div>
                </div>
                <div>
                    <select
                        value={selectedPatient}
                        onChange={(e) => setSelectedPatient(e.target.value)}
                        className="border border-[#e2e8f0] bg-white rounded-lg px-4 py-2 text-sm font-semibold text-[#475569] shadow-sm outline-none focus:ring-2 focus:ring-[#3b82f6]/20 transition-all min-w-[200px]"
                    >
                        <option value="">All Patients</option>
                        {patients?.map((pat) => (
                            <option key={pat.id} value={pat.id}>
                                {pat.user?.full_name || pat.patient_name || 'Unknown Patient'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Mood Progress */}
                <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-[#f1f5f9] p-6 h-[280px] flex flex-col">
                    <h3 className="text-[15px] font-bold text-[#334155] mb-6">Mood Progress</h3>
                    <div className="flex-1 -ml-4 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={moodData} margin={{ top: 5, right: 30, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} ticks={[2, 5, 7, 8, 10]} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorMood)"
                                    activeDot={{ r: 6, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                                    dot={{ r: 4, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="absolute right-0 top-1/4 text-xs font-semibold text-[#64748b]">High</div>
                        <div className="absolute right-0 bottom-8 text-xs font-semibold text-[#64748b]">Low</div>
                    </div>
                </div>

                {/* Symptom Severity */}
                <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-[#f1f5f9] p-6 h-[280px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[15px] font-bold text-[#334155]">Symptom Severity</h3>
                        <div className="flex items-center gap-4 text-[13px] font-medium text-[#475569]">
                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span>Anxiety</div>
                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#10b981]"></span>Depression</div>
                        </div>
                    </div>
                    <div className="flex-1 -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={symptomData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAnx" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorDep" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} ticks={[0, 4, 6, 8, 10]} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="anxiety" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAnx)" dot={{ r: 4, fill: '#fff', stroke: '#8b5cf6', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                <Area type="monotone" dataKey="depression" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDep)" dot={{ r: 4, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Session Attendance */}
                <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-[#f1f5f9] p-6 h-[280px] flex flex-col">
                    <h3 className="text-[15px] font-bold text-[#334155] mb-2">Session Attendance</h3>
                    <div className="flex-1 -ml-4 mt-2">
                        <ResponsiveContainer width="100%" height="80%">
                            <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={16}>
                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} ticks={[2, 6, 8, 10]} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="attended" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="missed" fill="#f97316" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="canceled" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="flex items-center gap-6 text-[13px] font-medium text-[#475569] mt-2 justify-center lg:justify-start lg:ml-12">
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#3b82f6]"></span>Attended</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#f97316]"></span>Missed</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#94a3b8]"></span>Canceled</div>
                        </div>
                    </div>
                </div>

                {/* Goal Progress */}
                <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-[#f1f5f9] p-6 h-[280px] flex flex-col">
                    <h3 className="text-[15px] font-bold text-[#334155] mb-6">Goal Progress</h3>
                    <div className="flex-1 flex flex-col justify-center space-y-6">

                        {/* Goal 1 */}
                        <div className="flex items-center gap-6">
                            <span className="text-[14px] font-bold text-[#1e293b] min-w-[50px]">Goal 1</span>
                            <div className="flex-1 h-8 bg-[#e8eef6] rounded-md relative flex items-center overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 bg-[#3b82f6] rounded-md" style={{ width: '55%' }}></div>
                                <span className="relative z-10 text-white text-[12px] font-medium pl-3 px-2 truncate mix-blend-screen">
                                    In Progress
                                </span>
                            </div>
                        </div>

                        {/* Goal 2 */}
                        <div className="flex items-center gap-6">
                            <span className="text-[14px] font-bold text-[#1e293b] min-w-[50px]">Goal 2</span>
                            <div className="flex-1 h-8 bg-[#e8eef6] rounded-md relative flex items-center overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 bg-[#4ade80] rounded-md border-y border-l border-[#22c55e]/20" style={{ width: '85%' }}></div>
                                <span className="relative z-10 text-white text-[12px] font-medium pl-3 px-2 truncate drop-shadow-md">
                                    Completed
                                </span>
                            </div>
                        </div>

                        {/* Goal 3 */}
                        <div className="flex items-center gap-6">
                            <span className="text-[14px] font-bold text-[#1e293b] min-w-[50px]">Goal 3</span>
                            <div className="flex-1 h-8 bg-[#e2e8f0] rounded-md relative flex items-center overflow-hidden mix-blend-multiply opacity-60">
                                <div className="absolute left-0 top-0 bottom-0 bg-[#cbd5e1] rounded-md" style={{ width: '0%' }}></div>
                                <span className="relative z-10 text-[#475569] text-[12px] font-medium pl-3 px-2 truncate">
                                    Not Started
                                </span>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
