import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Users, UserCheck, CreditCard, Activity, ShieldCheck, Globe, TrendingUp, Zap, CheckCircle2, AlertCircle, Stethoscope, ArrowRight } from 'lucide-react';
import { fetchOrganizations } from '../../store/slices/OrgSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export default function SuperAdminDashboard() {
    const dispatch = useDispatch();
    const { list: organizations } = useSelector((state) => state.organizations);
    const { list: users } = useSelector((state) => state.users);
    const { list: patients } = useSelector((state) => state.patients);
    const { token } = useSelector((state) => state.auth);

    const totalOrganizations = organizations.length;
    const activeLicenses = organizations.filter(org => org.license_key).length;

    // Calculate real counts
    const totalDoctors = users.filter(u => u.role?.toUpperCase() === 'DOCTOR').length;
    const totalReceptionists = users.filter(u => u.role?.toUpperCase() === 'RECEPTIONIST').length;
    const totalPatients = patients.length;

    useEffect(() => {
        // Only fetch data if user is authenticated
        if (token) {
            dispatch(fetchOrganizations());
            dispatch(fetchUsers());
            dispatch(fetchPatients());
        }
    }, [dispatch, token]);

    const stats = [
        {
            label: 'Total Organizations',
            value: totalOrganizations,
            icon: Building2,
            gradient: 'from-blue-500 to-cyan-500',
            //change: '+12%',
            trend: 'up'
        },
        {
            label: 'Total Practitioners',
            value: totalDoctors,
            icon: Stethoscope,
            gradient: 'from-purple-500 to-pink-500',
            //change: '+23%',
            trend: 'up'
        },
        {
            label: 'Total Receptionists',
            value: totalReceptionists,
            icon: UserCheck,
            gradient: 'from-emerald-500 to-teal-500',
            //change: '+15%',
            trend: 'up'
        },
        {
            label: 'Total Patients',
            value: totalPatients,
            icon: Users,
            gradient: 'from-orange-500 to-amber-500',
            //change: 'Optimal',
            trend: 'stable'
        },
    ];

    const getTimeAgo = (dateString) => {
        if (!dateString) return '';
        // Ensure date is treated as UTC
        const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
        const date = new Date(utcDateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    };

    const recentActivity = [...organizations]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
        .map(org => ({
            org: org.name,
            action: 'New organization registered',
            time: getTimeAgo(org.created_at),
            status: 'success'
        }));

    const getChartData = () => {
        const counts = {};

        // Initialize the last 4 months to 0
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const name = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            counts[key] = { name, count: 0, sortKey: key };
        }

        organizations.forEach(org => {
            if (!org.created_at) return;
            const d = new Date(org.created_at);
            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            // Only add if the month is in our last 4 months window
            if (counts[key]) {
                counts[key].count += 1;
            }
        });

        return Object.values(counts).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    };

    const chartData = getChartData();

    // Generate User Growth Data (Doctors, Receptionists, Patients) by Month for the last 3 months
    const getUserChartData = () => {
        const dataMap = {};

        // Initialize the last 3 months to 0
        const now = new Date();
        for (let i = 2; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const name = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            dataMap[key] = { name, Practitioners: 0, Receptionists: 0, Patients: 0, sortKey: key };
        }

        // Helper to process accounts
        const processAccount = (account, roleType) => {
            const dateStr = account.created_at || account.date_joined || account.updated_at || account.last_login;

            let d;
            if (!dateStr) {
                // Fallback for mocked/migrated accounts without timestamps, so they show in the current month's count
                d = new Date();
            } else {
                d = new Date(dateStr);
            }

            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            // Only add if the month is in our last 3 months window
            if (dataMap[key]) {
                dataMap[key][roleType] += 1;
            }
        };

        // Categorize Users (Doctors & Receptionists)
        users.forEach(u => {
            if (u.role?.toUpperCase() === 'DOCTOR' || u.is_doctor) processAccount(u, 'Practitioners');
            else if (u.role?.toUpperCase() === 'RECEPTIONIST') processAccount(u, 'Receptionists');
        });

        // Categorize Patients
        patients.forEach(p => processAccount(p, 'Patients'));

        // Format mapping into array suitable for Recharts, sorted by date format
        return Object.values(dataMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    };

    const userChartData = getUserChartData();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6 lg:p-8">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        rotate: [0, -90, 0],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl"
                />
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative z-10 space-y-8"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-transparent bg-clip-text  bg-slate-800 mb-2">
                            Platform Overview
                        </h1>
                        <p className="text-slate-600 font-medium flex items-center gap-2">
                            <Globe size={18} className="text-primary-500" />
                            Global system governance and organization metrics
                        </p>
                    </div>
                    {/* <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-lg shadow-emerald-500/30"
                    >
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="h-2 w-2 rounded-full bg-white"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider">All Systems Operational</span>
                    </motion.div> */}
                </motion.div>

                {/* Stats Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {stats.map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -5, scale: 1.02 }}
                                className="relative group"
                            >
                                <div className="relative backdrop-blur-xl bg-white/80 p-6 rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                                    {/* Gradient overlay */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />

                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-4">
                                            <motion.div
                                                whileHover={{ rotate: 360 }}
                                                transition={{ duration: 0.5 }}
                                                className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}
                                            >
                                                <Icon size={24} className="text-white" />
                                            </motion.div>
                                            <div className="flex items-center gap-1 text-xs font-bold">

                                                <span className={stat.trend === 'up' ? 'text-emerald-600' : 'text-slate-600'}>
                                                    {stat.change}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-500 mb-1">{stat.label}</p>
                                        <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* Activity Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
                    {/* Left Column: Organization & User Growth Charts */}
                    <div className="space-y-6 md:space-y-8 flex flex-col w-full">
                        {/* Organization Growth Chart */}
                        <motion.div
                            variants={itemVariants}
                            className="relative backdrop-blur-xl bg-white/80 rounded-2xl shadow-xl border border-white/50 overflow-hidden flex flex-col h-[400px]"
                        >
                            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-primary-50 to-purple-50">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="text-primary-600" size={24} />
                                    Organization Growth
                                </h3>
                            </div>
                            <div className="p-6 flex-1 w-full h-full min-h-0">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                                labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                                            />
                                            <Line type="monotone" dataKey="count" name="Organizations" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                                        Not enough data to display growth
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Platform User Growth Line Chart */}
                        <motion.div
                            variants={itemVariants}
                            className="relative backdrop-blur-xl bg-white/80 rounded-2xl shadow-xl border border-white/50 overflow-hidden flex flex-col h-[400px]"
                        >
                            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Users className="text-blue-600" size={24} />
                                    Platform User Signups
                                </h3>
                            </div>
                            <div className="p-6 flex-1 w-full h-full min-h-0">
                                {userChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={userChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                                labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                                            <Line type="monotone" dataKey="Practitioners" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="Patients" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="Receptionists" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                                        Not enough data to display user growth
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: Platform Controls & Recent Activity */}
                    <div className="space-y-6 md:space-y-8 flex flex-col">
                        {/* Platform Controls */}
                        {/* <motion.div
                            variants={itemVariants}
                            className="relative backdrop-blur-xl bg-white/80 rounded-2xl shadow-xl border border-white/50 overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <ShieldCheck className="text-indigo-600" size={24} />
                                    Platform Controls
                                </h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 gap-4">
                                {[
                                    { label: 'Manage Organizations', icon: Building2, path: '/superadmin/organizations', color: 'blue' },
                                    { label: 'Hospital Intel', icon: Stethoscope, path: '/superadmin/hospitals', color: 'purple' }
                                ].map((action) => (
                                    <Link
                                        key={action.label}
                                        to={action.path}
                                        className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md border border-slate-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <action.icon size={20} />
                                            </div>
                                            <span className="font-bold text-slate-700">{action.label}</span>
                                        </div>
                                        <ArrowRight size={18} className="text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </motion.div> */}

                        {/* Recent Activity */}
                        <motion.div
                            variants={itemVariants}
                            className="relative backdrop-blur-xl bg-white/80 rounded-2xl shadow-xl border border-white/50 overflow-hidden flex-1"
                        >
                            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-primary-50 to-purple-50">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Activity className="text-primary-600" size={24} />
                                    Recent Activity
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                {recentActivity.map((activity, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + index * 0.1 }}
                                        whileHover={{ x: 5 }}
                                        className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                                    >
                                        <div className={`p-2 rounded-lg ${activity.status === 'success' ? 'bg-emerald-100' : 'bg-blue-100'
                                            }`}>
                                            {activity.status === 'success' ? (
                                                <CheckCircle2 size={20} className="text-emerald-600" />
                                            ) : (
                                                <AlertCircle size={20} className="text-blue-600" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-900">{activity.org}</p>
                                            <p className="text-sm text-slate-600">{activity.action}</p>
                                            <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                                        </div>
                                    </motion.div>
                                ))}
                                {recentActivity.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 text-sm font-medium">
                                        No recent activity to show
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
