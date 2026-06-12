import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Lock } from 'lucide-react';
import toggleNotification from '../../store/slices/SettingsSlice'

export default function PractitionerSettings() {
    const [profile, setProfile] = useState({
        fullName: 'Dr. Sarah Mitchell',
        specialization: 'Clinical Psychology',
        email: 's.mitchell@mindcare.com',
        license: 'PSY-2026-4821'
    });

    const dispatch = useDispatch();
    const notifications = useSelector(state => state.settings?.notifications || {
        appointmentReminders: true,
        pendingNotes: true,
        patientUpdates: false
    });

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleToggle = (key) => {
        dispatch(toggleNotification(key));
    };

    return (
        <div className="space-y-6 max-w-4xl pt-4">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#0c3966]">Settings</h1>
                <p className="text-[#647c94]">Manage your profile and preferences</p>
            </div>

            {/* Profile Information */}
            <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-6 mb-6">
                <h2 className="text-[17px] font-bold text-[#0c3966] mb-6">Profile Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-[#0c3966] mb-2">Full Name</label>
                        <input
                            type="text"
                            name="fullName"
                            value={profile.fullName}
                            onChange={handleProfileChange}
                            className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2 bg-[#f8fafc] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2870c0]/20 focus:border-[#2870c0] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-[#0c3966] mb-2">Specialization</label>
                        <input
                            type="text"
                            name="specialization"
                            value={profile.specialization}
                            onChange={handleProfileChange}
                            className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2 bg-[#f8fafc] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2870c0]/20 focus:border-[#2870c0] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-[#0c3966] mb-2">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={profile.email}
                            onChange={handleProfileChange}
                            className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2 bg-[#f8fafc] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2870c0]/20 focus:border-[#2870c0] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-[#0c3966] mb-2">License Number</label>
                        <input
                            type="text"
                            name="license"
                            value={profile.license}
                            onChange={handleProfileChange}
                            className="w-full border border-[#e2e8f0] rounded-lg px-4 py-2 bg-[#f8fafc] text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2870c0]/20 focus:border-[#2870c0] transition-colors"
                        />
                    </div>
                </div>
                <button className="bg-[#2870c0] hover:bg-[#1f5a9e] text-white text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors">
                    Save Changes
                </button>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-6 mb-6">
                <h2 className="text-[17px] font-bold text-[#0c3966] mb-6">Notifications</h2>
                <div className="space-y-0 divide-y divide-[#f1f5f9]">
                    <div className="flex items-center justify-between pb-5">
                        <div>
                            <h3 className="text-[15px] font-semibold text-[#0c3966]">Appointment Reminders</h3>
                            <p className="text-[13px] text-[#647c94]">Get notified 30 min before sessions</p>
                        </div>
                        <button
                            onClick={() => handleToggle('appointmentReminders')}
                            className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${notifications.appointmentReminders ? 'bg-[#2870c0]' : 'bg-[#e2e8f0]'}`}
                        >
                            <span className={`bg-white w-4 h-4 rounded-full transition-transform transform shadow-sm ${notifications.appointmentReminders ? 'translate-x-7' : 'translate-x-1'}`}></span>
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-5">
                        <div>
                            <h3 className="text-[15px] font-semibold text-[#0c3966]">Pending Notes Alerts</h3>
                            <p className="text-[13px] text-[#647c94]">Daily reminder for unsigned notes</p>
                        </div>
                        <button
                            onClick={() => handleToggle('pendingNotes')}
                            className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${notifications.pendingNotes ? 'bg-[#2870c0]' : 'bg-[#e2e8f0]'}`}
                        >
                            <span className={`bg-white w-4 h-4 rounded-full transition-transform transform shadow-sm ${notifications.pendingNotes ? 'translate-x-7' : 'translate-x-1'}`}></span>
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between pt-5">
                        <div>
                            <h3 className="text-[15px] font-semibold text-[#0c3966]">Patient Updates</h3>
                            <p className="text-[13px] text-[#647c94]">Notifications for patient status changes</p>
                        </div>
                        <button
                            onClick={() => handleToggle('patientUpdates')}
                            className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${notifications.patientUpdates ? 'bg-[#2870c0]' : 'bg-[#e2e8f0]'}`}
                        >
                            <span className={`bg-white w-4 h-4 rounded-full transition-transform transform shadow-sm ${notifications.patientUpdates ? 'translate-x-7' : 'translate-x-1'}`}></span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Access Restrictions */}
            <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-6 mb-6">
                <h2 className="text-[17px] font-bold text-[#0c3966] mb-3">Access Restrictions</h2>
                <p className="text-[14px] text-[#475569] mb-5 leading-relaxed max-w-3xl">
                    As a Practitioner, you can only access your assigned patients' data. System-level admin settings, other practitioners' patients, audit logs, and original intake files are restricted.
                </p>
                <div className="flex items-center gap-2 bg-[#f0f5fa] px-4 py-2.5 rounded-lg border border-[#e1eaf4] w-fit">
                    <Lock size={15} className="text-[#cd9e22]" style={{ fill: '#fae3a1', strokeWidth: 2 }} />
                    <span className="font-medium text-[#475569] text-[13px]">Your role:</span>
                    <span className="px-2 py-0.5 bg-[#dbe8f5] text-[#2870c0] font-semibold rounded text-xs">Practitioner</span>
                </div>
            </div>
        </div>
    );
}
