import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Patients from './pages/doctor/Patients';
import Sessions from './pages/Sessions';
import SessionDetails from './pages/SessionDetails';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import Organizations from './pages/superadmin/Organizations';
import SuperAdminUsers from './pages/superadmin/Users';
import AudioRecords from './pages/superadmin/AudioRecords';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminAppointments from './pages/admin/Apponitments';
import Roles from './pages/admin/Roles';
import ClinicSettings from './pages/admin/ClinicSettings';
import WorkingHours from './pages/admin/WorkingHours/WorkingHours';
import Analytics from './pages/admin/Analytics';
import ActivityPage from './pages/admin/Activity';
import Branding from './pages/admin/Branding';
import AuditLogs from './pages/admin/AuditLogs';
import Notifications from './pages/admin/Notifications';
import AdminSettings from './pages/admin/Settings';
import AdminCheckAvailabilities from './pages/admin/CheckAvailabilities';
import ReceptionistDashboard from './pages/receptionist/Dashboard';
import ReceptionistPatients from './pages/receptionist/Patients';
import ReceptionistAppointments from './pages/receptionist/Appointments';
import ReceptionistCalendar from './pages/receptionist/Calendar';
import ReceptionistAvailabilities from './pages/receptionist/DoctorAvailability';
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorPatients from './pages/doctor/Patients';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorSessionMode from './pages/doctor/SessionMode';
import DoctorSettings from './pages/doctor/Settings';
import Layout from './layouts/Layout';
import Login from './commenlogin/Login';
import SoapNotes from './pages/doctor/SoapNotes';
import LongitudinalTrends from './pages/doctor/LongitudinalTrends';
import DoctorTranscript from './pages/doctor/Transcript';
import DoctorAvailability from './pages/doctor/Availability';
import DoctorPatientFile from './pages/doctor/PatientFile';


function App() {
    const { token, user } = useSelector((state) => state.auth);

    return (
        <Router>
            <Routes>
                <Route path="/admin" element={
                    !token ? (
                        <Login allowedRoles={['SUPER_ADMIN', 'ADMIN', 'HOSPITAL']} portalTitle="Clinical Operations Portal" />
                    ) : (
                        (() => {
                            const role = (user?.role || user?.user?.role)?.toUpperCase();
                            if (role === 'SUPER_ADMIN') return <Navigate to="/superadmin" />;
                            if (role === 'ADMIN' || role === 'HOSPITAL') return <Navigate to="/hospital-admin" />;
                            return <Navigate to="/" />;
                        })()
                    )
                } />
                <Route path="/" element={
                    !token ? (
                        <Auth />
                    ) : (
                        (() => {
                            const role = (user?.role || user?.user?.role)?.toUpperCase();
                            if (role === 'SUPER_ADMIN') return <Navigate to="/superadmin" />;
                            if (role === 'ADMIN' || role === 'HOSPITAL') return <Navigate to="/hospital-admin" />;
                            if (role === 'RECEPTIONIST') return <Navigate to="/receptionist" />;
                            if (role === 'DOCTOR') return <Navigate to="/doctor" />;
                            return <Dashboard />;
                        })()
                    )
                } />
                <Route path="/register" element={<Auth />} />
                <Route element={token ? <Layout /> : <Navigate to="/" />}>
                    {/* Common Routes - protected by backend mainly but UI should also guard */}
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/sessions" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorTranscript /> : <Sessions />
                    } />
                    <Route path="/sessions/:id" element={<SessionDetails />} />

                    {/* Super Admin Routes */}
                    <Route path="/superadmin" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/organizations" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <Organizations /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/users" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <SuperAdminUsers /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/audio-records" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <AudioRecords /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/register" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <Auth /> : <Navigate to="/" />
                    } />

                    {/* Admin Routes */}
                    <Route path="/hospital-admin" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/users" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminUsers /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/appointments" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminAppointments /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/availabilities" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminCheckAvailabilities /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/roles" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <Roles /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/clinic-settings" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <ClinicSettings /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/working-hours" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <WorkingHours /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/analytics" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <Analytics /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/activity" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <ActivityPage /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/notifications" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <Notifications /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/branding" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <Branding /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/audit-logs" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AuditLogs /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/settings" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminSettings /> : <Navigate to="/" />
                    } />

                    {/* Receptionist Routes */}
                    <Route path="/receptionist" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/receptionist/patients" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistPatients /> : <Navigate to="/" />
                    } />
                    <Route path="/receptionist/appointments" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistAppointments /> : <Navigate to="/" />
                    } />
                    <Route path="/receptionist/calendar" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistCalendar /> : <Navigate to="/" />
                    } />
                    <Route path="/receptionist/availabilities" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistAvailabilities /> : <Navigate to="/" />
                    } />

                    {/* Doctor Routes */}
                    <Route path="/doctor/patient-file/:patientId" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorPatientFile /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/patients" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorPatients /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/schedule" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorAppointments /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/session/:appointmentId/:patientId" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorSessionMode /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/session/:patientId" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorSessionMode /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/soap-notes" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <SoapNotes /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/settings" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorSettings /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/trends" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <LongitudinalTrends /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/availability" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorAvailability /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorDashboard /> : <Navigate to="/" />
                    } />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;

