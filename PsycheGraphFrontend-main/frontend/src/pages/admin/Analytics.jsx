import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import {
    Calendar,
    BarChart3,
    TrendingUp,
    Users,
    TrendingDown,
    Activity
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';

export default function Analytics() {
    const dispatch = useDispatch();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: users, loading: userLoading } = useSelector((state) => state.users);

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchUsers());
    }, [dispatch]);

    // --- Derived Metrics ---
    const stats = useMemo(() => {
        const total = appointments.length;
        const cancelledCount = appointments.filter(a => a.status?.toUpperCase() === 'CANCELLED').length;
        const completedCount = appointments.filter(a => a.status?.toUpperCase() === 'COMPLETED').length;

        // --- Calculate Weekly Patient Traffic ---
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyCount = appointments.filter(app => {
            if (!app.start_time) return false;
            const appDate = new Date(app.start_time);
            return !isNaN(appDate) && appDate >= startOfWeek && appDate <= now;
        }).length;

        // --- Calculate Growth Comparisons (for Total Appointments) ---
        const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

        let thisMonthApps = 0;
        let lastMonthApps = 0;

        appointments.forEach(app => {
            if (!app.start_time) return;
            const d = new Date(app.start_time);
            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (key === thisMonthKey) thisMonthApps++;
            else if (key === lastMonthKey) lastMonthApps++;
        });

        const appChange = lastMonthApps > 0
            ? ((thisMonthApps - lastMonthApps) / lastMonthApps * 100).toFixed(1)
            : thisMonthApps > 0 ? "100" : "0";

        return [
            {
                label: 'Total Appointments',
                value: total.toLocaleString(),
                change: appChange !== "0" ? `${appChange >= 0 ? '+' : ''}${appChange}% vs last month` : 'No change vs last month',
                icon: Calendar,
                color: 'text-indigo-500',
                bg: 'bg-indigo-50'
            },
            {
                label: 'Weekly Patient',
                value: weeklyCount.toLocaleString(),
                change: 'Current week',
                icon: BarChart3,
                color: 'text-blue-500',
                bg: 'bg-blue-50'
            },
            // {
            //     label: 'Cancellations',
            //     value: cancelledCount.toLocaleString(),
            //     change: 'Total absolute count',
            //     icon: TrendingDown,
            //     color: 'text-rose-500',
            //     bg: 'bg-rose-50'
            // },
            {
                label: 'Completed',
                value: completedCount.toLocaleString(),
                change: 'Total absolute count',
                icon: Activity,
                color: 'text-emerald-500',
                bg: 'bg-emerald-50'
            },
        ];
    }, [appointments]);

    // --- Chart Data ---
    const monthlyData = useMemo(() => {
        // Build last 4 months list
        const months = Array.from({ length: 4 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (3 - i));
            return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                name: d.toLocaleString('default', { month: 'short' })
            };
        });

        const appsMap = {};
        const cancelsMap = {};
        const completedMap = {};
        months.forEach(({ key }) => {
            appsMap[key] = 0;
            cancelsMap[key] = 0;
            completedMap[key] = 0;
        });

        // Populate from real appointments
        appointments.forEach(app => {
            if (!app.start_time) return;
            const d = new Date(app.start_time);
            if (isNaN(d)) return;

            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (appsMap[key] !== undefined) {
                const status = app.status?.toUpperCase() || 'UNKNOWN';
                if (status === 'CANCELLED') {
                    cancelsMap[key]++;
                } else if (status === 'COMPLETED') {
                    completedMap[key]++;
                    appsMap[key]++;
                } else if (status === 'SCHEDULED') {
                    appsMap[key]++;
                }
            }
        });

        return months.map(({ key, name }) => ({
            name,
            appointments: appsMap[key],
            cancellations: cancelsMap[key],
            completed: completedMap[key]
        }));
    }, [appointments]);

    const weeklyTrafficData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const trafficMap = days.reduce((acc, day) => ({ ...acc, [day]: 0 }), {});

        // Get the start of the current week (Sunday)
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        appointments.forEach(app => {
            if (!app.start_time) return;
            const appDate = new Date(app.start_time);
            if (isNaN(appDate)) return;

            // Check if appointment is within the current week
            if (appDate >= startOfWeek && appDate <= now) {
                const dayName = days[appDate.getDay()];
                trafficMap[dayName]++;
            }
        });

        // Return in Mon-Sun order as requested by standard UI patterns
        const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return orderedDays.map(day => ({
            name: day,
            patients: trafficMap[day]
        }));
    }, [appointments]);

    if (appLoading || userLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity className="text-indigo-500" size={40} />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-1 px-1">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Analytics</h1>
                <p className="text-[13px] text-slate-400 font-medium">Appointment and operational insights</p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
                            </div>
                            <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={20} strokeWidth={2.5} />
                            </div>
                        </div>
                        {stat.change && (
                            <p className={`text-[11px] font-bold ${stat.change.includes('+') ? 'text-emerald-500' : 'text-emerald-500'}`}>
                                {stat.change}
                            </p>
                        )}
                    </motion.div>
                ))}
            </div>


            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">

                {/* Monthly Appointments Area Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[380px]"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6 px-1">Monthly Appointments</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="appointments"
                                    stroke="#6366f1"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorApps)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cancellations"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    fillOpacity={0}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Weekly Patient Traffic Bar Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[380px]"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6 px-1">Weekly Patient Traffic</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={weeklyTrafficData}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc', radius: 8 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="patients" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40}>
                                    {weeklyTrafficData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#6366f1" className="hover:opacity-80 transition-opacity" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

            </div>

            {/* Monthly Trends Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                {/* Monthly Cancellations Bar Chart */}
                {/* <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[380px]"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                            <TrendingDown size={18} />
                        </div>
                        <h3 className="text-[13px] font-bold text-slate-800">Monthly Cancellations (Last 4 Months)</h3>
                    </div>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#fff1f2', radius: 8 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="cancellations" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#f43f5e" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div> */}

                {/* Monthly Completed Bar Chart */}
                {/* <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[380px]"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500">
                            <Activity size={18} />
                        </div>
                        <h3 className="text-[13px] font-bold text-slate-800">Monthly Completed (Last 4 Months)</h3>
                    </div>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f0fdf4', radius: 8 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40}>
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#10b981" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div> */}
            </div>
        </div>
    );
}
