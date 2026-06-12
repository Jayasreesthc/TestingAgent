import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { Calendar as CalendarIcon, List as ListIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function AdminAppointments() {
    const dispatch = useDispatch();
    const { list: appointments, loading } = useSelector((state) => state.appointments);

    const [viewMode, setViewMode] = useState('Calendar'); // 'Calendar' or 'List'

    // Generate dates for the top scroller
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState();
    const [dateOffset, setDateOffset] = useState(0); // For scrolling the dates

    useEffect(() => {
        dispatch(fetchAppointments());

        const dates = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push({
                dateObj: d,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: d.getDate(),
                fullDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            });
        }
        setAvailableDates(dates);
        setSelectedDate(dates[0].fullDate);
    }, [dispatch]);

    // Let's filter appointments for the selected date
    const selectedDateAppointments = useMemo(() => {
        if (!selectedDate) return [];
        // Extract real ones
        const forDay = appointments.filter(app => {
            if (!app.start_time) return false;
            const appDate = new Date(app.start_time);
            const localDateStr = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(appDate.getDate()).padStart(2, '0')}`;
            return localDateStr === selectedDate;
        }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        return forDay;
    }, [appointments, selectedDate]);

    // For the UI to look exactly like the screenshot with the given CSS,
    // we use a clean white layout with a distinct top tab
    return (
        <div className="space-y-6 w-full max-w-[1200px] mx-auto py-6">

            {/* Toggle Group */}
            <div className="flex p-1 bg-slate-50 border border-slate-200 rounded-xl w-fit">
                <button
                    onClick={() => setViewMode('Calendar')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
                        viewMode === 'Calendar' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <CalendarIcon size={16} />
                    Calendar
                </button>
                <button
                    onClick={() => setViewMode('List')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
                        viewMode === 'List' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <ListIcon size={16} />
                    List
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
                {/* Horizontal Date Scroller (Only in Calendar Mode like screenshot) */}
                {viewMode === 'Calendar' && (
                    <div className="p-4 flex items-center gap-2 border-b border-slate-50">
                        <button
                            onClick={() => setDateOffset(Math.max(0, dateOffset - 1))}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex gap-4 overflow-hidden w-full max-w-[500px]">
                            {availableDates.slice(dateOffset, dateOffset + 7).map((item) => {
                                const isSelected = selectedDate === item.fullDate;
                                return (
                                    <button
                                        key={item.fullDate}
                                        onClick={() => setSelectedDate(item.fullDate)}
                                        className={cn(
                                            "flex flex-col items-center justify-center min-w-[52px] h-[64px] rounded-[14px] transition-all shrink-0",
                                            isSelected
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "bg-transparent text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className={cn("text-[12px] font-semibold", isSelected ? "text-white/90" : "text-slate-500")}>{item.dayName}</span>
                                        <span className={cn("text-[16px] font-bold mt-0.5", isSelected ? "text-white" : "text-slate-800")}>{item.dayNumber}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setDateOffset(Math.min(availableDates.length - 7, dateOffset + 1))}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}

                {/* Body Area */}
                <div className="p-6">
                    <div className="flex flex-col gap-3">
                        {loading && <div className="p-12 text-center text-slate-500 font-medium">Loading appointments...</div>}

                        {!loading && selectedDateAppointments.length === 0 && (
                            <div className="py-16 text-center rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/50">
                                <p className="text-slate-500 font-medium text-sm">No appointments found for this selection.</p>
                            </div>
                        )}


                        {!loading && selectedDateAppointments.map((app, index) => {
                            const timeStr = new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            const doctorName = app.doctor_name || app.doctor?.full_name || 'Doctor';
                            const patientName = app.patient_name || app.patient?.full_name;

                            // Badges matching the screenshot logic
                            // Available (Outline grey), Booked/Confirmed (Teal), Cancelled (Red)
                            let statusClass = "bg-white text-slate-500 border border-slate-300";
                            let statusText = app.status || "Available";

                            if (statusText.toUpperCase() === 'BOOKED' || statusText.toUpperCase() === 'CONFIRMED' || statusText.toUpperCase() === 'SCHEDULED' || statusText.toUpperCase() === 'COMPLETED') {
                                statusClass = "bg-indigo-600 text-white border-transparent";
                                statusText = statusText.toUpperCase() === 'SCHEDULED' ? 'Booked' : statusText;
                            } else if (statusText.toUpperCase() === 'CANCELLED') {
                                statusClass = "bg-[#ef4444] text-white border-transparent";
                            }

                            return (
                                <div key={app.id || index} className="flex items-center justify-between p-4 rounded-[14px] border border-slate-200 bg-white">
                                    <div className="flex items-center gap-12">
                                        <span className="text-sm font-semibold text-slate-400 w-12">{timeStr}</span>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold text-slate-700">Pr. {doctorName}</span>
                                            {patientName && (
                                                <span className="text-[11px] font-black text-indigo-500 uppercase tracking-wider">
                                                    Patient: {patientName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={cn("px-4 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase", statusClass)}>
                                        {statusText}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
