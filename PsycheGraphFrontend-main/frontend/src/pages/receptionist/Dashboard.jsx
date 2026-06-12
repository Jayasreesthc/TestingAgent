import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    Users,
    Calendar,
    Clock,
    UserPlus,
    Loader2,
    ArrowRight,
    CalendarCheck,
    Check,
    TrendingUp,
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    AlertTriangle
} from 'lucide-react';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';

const formatDateLocal = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const MiniCalendar = ({ selectedDate, onSelectDate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const days = [];
    const totalDays = daysInMonth(year, month);
    const offset = firstDayOfMonth(year, month);

    for (let i = 0; i < offset; i++) {
        days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
        days.push(i);
    }

    const prevMonth = () => setCurrentDate(new Date(year, month - 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1));

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const isSelected = (day) => {
        if (!day || !selectedDate) return false;
        const d = new Date(year, month, day);
        return formatDateLocal(d) === selectedDate;
    };

    const handleDayClick = (day) => {
        if (!day) return;
        const clicked = new Date(year, month, day);
        onSelectDate(formatDateLocal(clicked));
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800">{monthName} <span className="text-indigo-600 ml-1">{year}</span></h3>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-y-2 text-center">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <span key={day} className="text-[10px] font-bold text-slate-400 tracking-wider mb-2">{day}</span>
                ))}

                {days.map((day, idx) => (
                    <div key={idx} className="flex justify-center items-center h-8">
                        {day ? (
                            <span
                                onClick={() => handleDayClick(day)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all cursor-pointer
                                    ${isSelected(day)
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-300'
                                        : isToday(day)
                                            ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                                            : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                                    }`}
                            >
                                {day}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function ReceptionistDashboard() {
    const dispatch = useDispatch();
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments, loading: appointmentsLoading } = useSelector((state) => state.appointments);
    const { user } = useSelector((state) => state.auth);

    const today = formatDateLocal(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
    }, [dispatch]);

    const selectedAppointments = appointments
        .filter(app => app.start_time.startsWith(selectedDate))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const isSelectedToday = selectedDate === today;
    const selectedDateLabel = isSelectedToday
        ? "Today's Appointments"
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' Appointments';

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const upcomingCheckIns = appointments.filter(app => {
        const start = new Date(app.start_time);
        return start >= now && start <= oneHourLater && app.status === 'SCHEDULED';
    }).length;

    const stats = [
        {
            label: "Today's Appointments",
            value: appointments.filter(app => app.start_time.startsWith(today)).length,
            icon: Calendar,
            color: 'bg-indigo-50 text-indigo-600',
            iconBg: 'bg-indigo-100',
            sub: 'Scheduled for today'
        },
        {
            label: 'Total Patients',
            value: patients.length,
            icon: Users,
            color: 'bg-emerald-50 text-emerald-600',
            iconBg: 'bg-emerald-100',
            sub: 'Registered in system'
        },
        {
            label: 'Upcoming Check-ins',
            value: upcomingCheckIns,
            icon: Clock,
            color: 'bg-amber-50 text-amber-600',
            iconBg: 'bg-amber-100',
            sub: 'In the next hour'
        },
        // {
        //     label: 'Completed Patients',
        //     value: appointments.filter(app => app.status === 'COMPLETED').length,
        //     icon: Check,
        //     color: 'bg-green-50 text-green-900',
        //     iconBg: 'bg-green-100',
        //     sub: 'Total completed sessions'
        // }
    ];

    if (patientsLoading || appointmentsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={36} />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-4"
            >
                <div>
                    <p className="text-sm font-semibold text-indigo-600 mb-1">Receptionist Portal</p>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} <span className="text-slate-800">{(user?.full_name || user?.name || user?.username || 'Receptionist')}</span>
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Here's what's happening at your front desk today.
                    </p>
                </div>
                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.location.href = '/receptionist/patients'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm shadow-sm"
                    >
                        <UserPlus size={16} className="text-indigo-500" />
                        Register Patient
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.location.href = '/receptionist/appointments'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/25 font-semibold text-sm hover:bg-indigo-700 transition-all"
                    >
                        <Calendar size={16} />
                        Book Appointment
                    </motion.button>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 cursor-default"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2.5 rounded-xl ${stat.iconBg}`}>
                                    <Icon size={20} className={stat.color.split(' ')[1]} />
                                </div>
                                <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                    <TrendingUp size={12} />
                                    <span>Active</span>
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</p>
                            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                            <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                        </motion.div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Schedule Preview - takes 3 columns */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col"
                >
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-50">
                                <CalendarCheck size={18} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">{selectedDateLabel}</h3>
                        </div>
                        {/* <a href="/receptionist/appointments" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                            View all
                            <ArrowUpRight size={14} />
                        </a> */}
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[420px] bg-slate-50/50 p-5">
                        {selectedAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl h-full border border-slate-200">
                                <div className="p-4 rounded-full bg-slate-50 mb-4">
                                    <Calendar size={32} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-semibold text-slate-400">
                                    No appointments for {isSelectedToday ? 'today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">New bookings will appear here</p>
                            </div>
                        ) : (
                            <div className="flex flex-col min-w-[600px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Header */}
                                <div className="grid grid-cols-5 px-6 py-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-500 text-xs uppercase tracking-wider">
                                    <div>Date</div>
                                    <div>Time</div>
                                    <div>Name</div>
                                    <div>Practitioner</div>
                                    <div className="text-center">Status</div>
                                </div>

                                {/* Rows */}
                                <div className="divide-y divide-slate-100">
                                    {selectedAppointments.map((app, index) => {
                                        const d = new Date(app.start_time);
                                        const fDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;

                                        const rawTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
                                        const fTime = rawTime.replace(':', '.');

                                        const doctorName = app.doctor_name ? app.doctor_name.split(' ').pop() : 'Assigned';

                                        const statusMap = {
                                            'SCHEDULED': { label: 'Pending', bg: 'bg-[#ffedcc]', text: 'text-[#865922]', dot: 'bg-[#865922]' },
                                            'COMPLETED': { label: 'Complete', bg: 'bg-[#c5fcce]', text: 'text-[#2a8b3f]', dot: 'bg-[#2a8b3f]' }
                                        };

                                        const statusSty = statusMap[app.status] || { label: 'Incomplete', bg: 'bg-[#fcd2d2]', text: 'text-[#902424]', dot: 'bg-[#902424]' };



                                        return (
                                            <motion.div
                                                key={app.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.1 + index * 0.05 }}
                                                className="grid grid-cols-5 items-center px-6 py-4 text-sm hover:bg-slate-50 transition-colors cursor-pointer group"
                                                onClick={() => window.location.href = '/receptionist/appointments'}
                                            >
                                                <div className="font-medium text-slate-800">{fDate}</div>
                                                <div className="font-medium text-slate-800">{fTime}</div>
                                                <div className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors truncate pr-2">{app.patient_name || 'Patient TBD'}</div>
                                                <div className="font-medium text-slate-800 truncate pr-2">{doctorName}</div>
                                                <div className="flex justify-center">
                                                    <div className={`px-3 py-1.5 flex items-center justify-center gap-2 rounded-full ${statusSty.bg} ${statusSty.text} min-w-[100px]`}>
                                                        <div className={`w-2 h-2 rounded-full ${statusSty.dot}`}></div>
                                                        <span className="text-[11px] font-bold tracking-wide">{statusSty.label}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Mini Calendar - takes 2 columns */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2"
                >
                    <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                </motion.div>
            </div>
        </div>
    );
}
