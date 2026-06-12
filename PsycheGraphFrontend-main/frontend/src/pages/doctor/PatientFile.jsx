// Clinical Protocol: Patient File Module v1.0.1 (Cache Clear)
import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    FileText, 
    Database, 
    History, 
    Activity, 
    Calendar, 
    Clock, 
    User, 
    ClipboardList,
    Save,
    Loader2,
    Shield,
    Video,
    Mic,
    CheckCircle2,
    AlertCircle,
    Info,
    ArrowRight,
    Search,
    Filter,
    ArrowUpRight,
    Smartphone,
    Mail,
    MapPin,
    Hash,
    Plus,
    X,
    FileSignature,
    ClipboardPen,
    FileDown,
    Users
} from 'lucide-react';
import { fetchPatientById, fetchPatientIntake, createPatientIntake, fetchPatientFile, updatePatientFile } from '../../store/slices/PatientSlice';
import { updateSession } from '../../store/slices/SessionSlice';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function DoctorPatientFile() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    
    const { 
        currentPatient: patient, 
        loading: patientLoading,
        intakeData,
        intakeLoading,
        patientFile,
        fileLoading: sessionsLoading
    } = useSelector((state) => state.patients);
    const { user: authUser } = useSelector((state) => state.auth);
    const doctorId = authUser?.id || authUser?.user?.id || authUser?.doctor_id || '';

    const [activeTab, setActiveTab] = useState('Sessions'); // 'Intake', 'Sessions', 'History'
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isAddingIntake, setIsAddingIntake] = useState(false);
    const [showIntakeConfirm, setShowIntakeConfirm] = useState(false);
    const [viewingBackup, setViewingBackup] = useState(null);

    // Refs for scrolling in the large intake form
    const sectionRefs = {
        'Background': useRef(null),
        'Clinical Presentation': useRef(null),
        'HPI': useRef(null),
        'Psychiatric History': useRef(null),
        'Medical Profile': useRef(null),
        'Personal Development': useRef(null),
        'Socio-Occupational': useRef(null),
        'Family Dynamics': useRef(null),
        'Personality Traits': useRef(null)
    };

    const scrollToSection = (sectionName) => {
        sectionRefs[sectionName]?.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Form state for the active session editor
    const [editorData, setEditorData] = useState({
        notes: ''
    });

    const [intakeForm, setIntakeForm] = useState({
        full_name: '', date_of_birth: '', gender_pronouns: '', marital_status: '', occupation: '',
        nationality: '', place_of_residence: '', source_of_referral: '', date_of_admission: '',
        chief_complaint_patient: '', chief_complaint_informant: '', onset_and_duration: '',
        hpi_onset: 'abrupt', hpi_course: 'episodic', hpi_duration: '', hpi_precipitating: '',
        hpi_symptoms: '', hpi_treatment_received: '', hpi_impact_functioning: '',
        hpi_negative_history: '', hpi_review_of_systems: '', past_psych_episodes: '',
        past_hospitalisations: '', past_treatments: '', suicide_self_harm: '',
        violence_history: '', past_mh_services: '', childhood_illnesses: '',
        adult_illnesses: '', surgeries: '', current_medical: '', allergies: '',
        current_medications: '', birth_pregnancy: '', birth_delivery: '',
        developmental_milestones: '', childhood_temperament: '', childhood_separation: '',
        childhood_abuse: '', childhood_other: '', childhood_neurotic: '',
        education_school: '', education_performance: '', education_behaviour: '',
        education_qualification: '', education_relationships: '', occupational_history: '',
        occupational_other: '', military_service: '', relationship_history: '',
        relationship_current: '', relationship_sexual: '', children: '',
        forensic_history: '', financial_housing: '', substance_alcohol: '',
        substance_tobacco: '', substance_other: '', substance_prescription: '',
        substance_iv: '', substance_treatment: '', family_genogram: '',
        family_structure: '', family_psych_illness: '', family_medical: '',
        family_substance: '', family_dynamics: '', family_suicide: '',
        premorbid_mood: '', premorbid_traits: '', premorbid_relationships: '',
        premorbid_leisure: '', premorbid_coping: '', premorbid_values: '',
        premorbid_habits: '', premorbid_self_concept: '', premorbid_judgement: '',
        history_summary: ''
    });

    useEffect(() => {
        if (patient && !isAddingIntake) {
            setIntakeForm(prev => ({
                ...prev,
                full_name: patient.full_name || '',
                date_of_birth: patient.date_of_birth || '',
                gender_pronouns: patient.gender || ''
            }));
        }
    }, [patient, isAddingIntake]);

    useEffect(() => {
        if (patientId) {
            dispatch(fetchPatientById(patientId));
            dispatch(fetchPatientFile(patientId));
        }
    }, [dispatch, patientId]);

    useEffect(() => {
        if (activeTab === 'Intake' && patientId && !intakeData) {
            dispatch(fetchPatientIntake(patientId));
        }
    }, [dispatch, activeTab, patientId, intakeData]);

    const sessions = useMemo(() => {
        if (!patientFile?.sessions) return [];
        return [...patientFile.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [patientFile]);

    // Select the latest session by default when sessions load, and clear on patient change
    useEffect(() => {
        setSelectedSessionId(null);
    }, [patientId]);

    useEffect(() => {
        if (sessions.length > 0 && !selectedSessionId) {
            setSelectedSessionId(sessions[0].id);
        }
    }, [sessions, selectedSessionId]);

    // Update editor when session changes
    useEffect(() => {
        const session = sessions.find(s => s.id === selectedSessionId);
        if (session) {
            setEditorData({
                subjective: session.soap_notes?.subjective || '',
                objective: session.soap_notes?.objective || '',
                assessment: session.soap_notes?.assessment || '',
                plan: session.soap_notes?.plan || '',
                treatment_plan: session.treatment_plan || '',
                summary: session.summary || '',
                transcript: session.transcript || '',
                notes: session.notes || ''
            });
        }
    }, [selectedSessionId, sessions]);

    const currentSession = sessions.find(s => s.id === selectedSessionId);

    // Auto-resize helper for textareas
    useEffect(() => {
        const textareas = document.querySelectorAll('.auto-resize-textarea');
        textareas.forEach(textarea => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
    }, [editorData, selectedSessionId, activeTab]);

    const handleSaveSession = async () => {
        if (!selectedSessionId) return;
        setIsSaving(true);
        try {
            await dispatch(updatePatientFile({
                id: patientId,
                data: {
                    date_of_birth: patient?.date_of_birth || '',
                    contact_number: patient?.contact_number || '',
                    email: patient?.email || '',
                    gender: patient?.gender || '',
                    address: patient?.address || '',
                    sessions: [
                        {
                            session_id: selectedSessionId,
                            soap_notes: {
                                subjective: editorData.subjective,
                                objective: editorData.objective,
                                assessment: editorData.assessment,
                                plan: editorData.plan
                            },
                            transcript: editorData.transcript,
                            summary: editorData.summary,
                            treatment_plan: editorData.treatment_plan,
                            notes: editorData.notes,
                            flags_data: currentSession?.flags_data || ''
                        }
                    ]
                }
            })).unwrap();
            
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            dispatch(fetchPatientFile(patientId));
        } catch (err) {
            console.error('Failed to update session:', err);
            alert('Failed to save session updates.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveIntake = async () => {
        setIsSaving(true);
        try {
            await dispatch(createPatientIntake({ 
                id: patientId, 
                data: intakeForm 
            })).unwrap();
            setIsAddingIntake(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            dispatch(fetchPatientIntake(patientId));
        } catch (err) {
            console.error('Failed to save intake:', err);
            alert('Failed to save intake file.');
        } finally {
            setIsSaving(false);
        }
    };

    if (patientLoading && !patient) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Patient Portfolio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Header / Top Navigation - Offset by main Layout header (h-16 sm:h-20) */}
            <div className="bg-white border-b border-slate-200 sticky top-16 lg:top-20 z-40">
                <div className="max-w-[1600px] mx-auto px-6 h-24 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => navigate('/doctor/patients')}
                            className="p-3 hover:bg-slate-50 rounded-2xl transition-all border border-slate-100 text-slate-400 hover:text-indigo-600"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                                <span className="text-xl font-black">{patient?.full_name?.[0]}</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{patient?.full_name}</h1>
                                <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <span>PID: {patientId}</span>
                                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                    <span>{patient?.age} Yrs • {patient?.gender}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
                        {['Intake', 'Sessions', 'History'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                                    activeTab === tab 
                                        ? "bg-white text-indigo-600 shadow-lg" 
                                        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                                )}
                            >
                                {tab === 'Intake' && <Shield size={12} className="inline mr-2 mb-0.5" />}
                                {tab === 'Sessions' && <Database size={12} className="inline mr-2 mb-0.5" />}
                                {tab === 'History' && <History size={12} className="inline mr-2 mb-0.5" />}
                                {tab === 'Intake' ? 'Intake File' : tab === 'Sessions' ? 'Session Files' : 'Version History'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-[1600px] mx-auto px-6 pt-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'Intake' && (
                        <motion.div
                            key="intake"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full"
                        >
                            {intakeLoading && !intakeData ? (
                                <div className="h-[600px] bg-white rounded-[2.5rem] border border-slate-200 flex flex-col items-center justify-center gap-4">
                                    <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retrieving Clinical Archive...</p>
                                </div>
                            ) : isAddingIntake ? (
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Add Intake File</h2>
                                            <p className="text-xs text-slate-400 mt-0.5">Fill in the clinical intake record for this patient</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsAddingIntake(false)}
                                                className="px-5 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => setShowIntakeConfirm(true)}
                                                disabled={isSaving}
                                                className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200"
                                            >
                                                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                                Save Intake
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-8 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar space-y-8">
                                        {[
                                            { title: '01 · Administrative & Demographics', cols: 3, fields: [
                                                { id: 'full_name', label: 'Full Name', type: 'input' },
                                                { id: 'date_of_birth', label: 'Date of Birth', type: 'date' },
                                                { id: 'gender_pronouns', label: 'Gender / Pronouns', type: 'input' },
                                                { id: 'marital_status', label: 'Marital Status', type: 'input' },
                                                { id: 'occupation', label: 'Occupation', type: 'input' },
                                                { id: 'nationality', label: 'Nationality', type: 'input' },
                                                { id: 'place_of_residence', label: 'Place of Residence', type: 'input' },
                                                { id: 'source_of_referral', label: 'Source of Referral', type: 'input' },
                                                { id: 'date_of_admission', label: 'Date of Admission', type: 'date' },
                                            ]},
                                            { title: '02 · Clinical Presentation', cols: 1, fields: [
                                                { id: 'chief_complaint_patient', label: 'Chief Complaint (Patient)', type: 'textarea' },
                                                { id: 'chief_complaint_informant', label: 'Chief Complaint (Informant)', type: 'textarea' },
                                                { id: 'onset_and_duration', label: 'Onset & Duration', type: 'input' },
                                            ]},
                                            { title: '03 · History of Presenting Illness', cols: 3, fields: [
                                                { id: 'hpi_onset', label: 'Onset Mode', type: 'select', options: ['abrupt','acute','sub-acute','insidious'] },
                                                { id: 'hpi_course', label: 'Clinical Course', type: 'select', options: ['improving','stable','fluctuating','progressive','episodic'] },
                                                { id: 'hpi_duration', label: 'Duration', type: 'input' },
                                                { id: 'hpi_precipitating', label: 'Precipitating Factors', type: 'textarea' },
                                                { id: 'hpi_symptoms', label: 'Symptoms', type: 'textarea' },
                                                { id: 'hpi_treatment_received', label: 'Treatment Received', type: 'textarea' },
                                                { id: 'hpi_impact_functioning', label: 'Functional Impact', type: 'textarea' },
                                                { id: 'hpi_negative_history', label: 'Negative History', type: 'textarea' },
                                                { id: 'hpi_review_of_systems', label: 'Review of Systems', type: 'textarea' },
                                            ]},
                                            { title: '04 · Past Psychiatric Profile', cols: 2, fields: [
                                                { id: 'past_psych_episodes', label: 'Previous Episodes', type: 'textarea' },
                                                { id: 'past_hospitalisations', label: 'Past Hospitalisations', type: 'textarea' },
                                                { id: 'past_treatments', label: 'Past Treatments', type: 'textarea' },
                                                { id: 'past_mh_services', label: 'MH Services Used', type: 'textarea' },
                                                { id: 'suicide_self_harm', label: 'Suicide / Self-Harm', type: 'textarea' },
                                                { id: 'violence_history', label: 'Violence / Aggression', type: 'textarea' },
                                            ]},
                                            { title: '05 · General Medical Status', cols: 3, fields: [
                                                { id: 'childhood_illnesses', label: 'Childhood Illnesses', type: 'input' },
                                                { id: 'adult_illnesses', label: 'Adult Illnesses', type: 'input' },
                                                { id: 'surgeries', label: 'Surgeries', type: 'input' },
                                                { id: 'current_medical', label: 'Current Medical Conditions', type: 'input' },
                                                { id: 'allergies', label: 'Allergies', type: 'input' },
                                                { id: 'current_medications', label: 'Current Medications', type: 'input' },
                                            ]},
                                            { title: '06 · Personal & Developmental History', cols: 4, fields: [
                                                { id: 'birth_pregnancy', label: 'Pregnancy History', type: 'input' },
                                                { id: 'birth_delivery', label: 'Delivery Details', type: 'input' },
                                                { id: 'developmental_milestones', label: 'Developmental Milestones', type: 'input' },
                                                { id: 'childhood_temperament', label: 'Childhood Temperament', type: 'input' },
                                                { id: 'childhood_separation', label: 'Separation Anxiety', type: 'input' },
                                                { id: 'childhood_abuse', label: 'Abuse History', type: 'input' },
                                                { id: 'childhood_neurotic', label: 'Neurotic Traits', type: 'input' },
                                                { id: 'childhood_other', label: 'Other Observations', type: 'input' },
                                            ]},
                                            { title: '07 · Socio-Occupational Log', cols: 2, fields: [
                                                { id: 'education_school', label: 'Academic Institution', type: 'input' },
                                                { id: 'education_qualification', label: 'Highest Qualification', type: 'input' },
                                                { id: 'education_performance', label: 'Academic Performance', type: 'input' },
                                                { id: 'education_behaviour', label: 'Behavioural Report', type: 'input' },
                                                { id: 'education_relationships', label: 'Peer Relationships', type: 'input' },
                                                { id: 'occupational_history', label: 'Employment History', type: 'input' },
                                                { id: 'occupational_other', label: 'Work Stressors', type: 'input' },
                                                { id: 'military_service', label: 'Military Service', type: 'input' },
                                                { id: 'financial_housing', label: 'Financial / Housing', type: 'input' },
                                                { id: 'forensic_history', label: 'Legal / Forensic', type: 'input' },
                                            ]},
                                            { title: '08 · Family & Interpersonal Dynamics', cols: 3, fields: [
                                                { id: 'family_genogram', label: 'Genogram Details', type: 'input' },
                                                { id: 'family_structure', label: 'Family Structure', type: 'input' },
                                                { id: 'family_psych_illness', label: 'Psychiatric History (Family)', type: 'input' },
                                                { id: 'family_medical', label: 'Medical History (Family)', type: 'input' },
                                                { id: 'family_substance', label: 'Substance Use (Family)', type: 'input' },
                                                { id: 'family_dynamics', label: 'Family Dynamics', type: 'input' },
                                                { id: 'family_suicide', label: 'Suicide History (Family)', type: 'input' },
                                                { id: 'substance_alcohol', label: 'Substance — Alcohol', type: 'input' },
                                                { id: 'substance_tobacco', label: 'Substance — Tobacco', type: 'input' },
                                                { id: 'substance_other', label: 'Substance — Other', type: 'input' },
                                                { id: 'relationship_history', label: 'Relationship History', type: 'input' },
                                                { id: 'relationship_current', label: 'Current Relationship', type: 'input' },
                                            ]},
                                            { title: '09 · Premorbid Personality & Conclusion', cols: 3, fields: [
                                                { id: 'premorbid_mood', label: 'Baseline Mood', type: 'input' },
                                                { id: 'premorbid_traits', label: 'Core Traits', type: 'input' },
                                                { id: 'premorbid_relationships', label: 'Social Patterns', type: 'input' },
                                                { id: 'premorbid_leisure', label: 'Leisure Activity', type: 'input' },
                                                { id: 'premorbid_coping', label: 'Coping Mechanisms', type: 'input' },
                                                { id: 'premorbid_values', label: 'Values / Beliefs', type: 'input' },
                                                { id: 'premorbid_habits', label: 'Habits / Routine', type: 'input' },
                                                { id: 'premorbid_self_concept', label: 'Self Concept', type: 'input' },
                                                { id: 'premorbid_judgement', label: 'Social Judgement', type: 'input' },
                                                { id: 'history_summary', label: 'Final Clinical History Summary', type: 'textarea', fullWidth: true },
                                            ]},
                                        ].map((section, si) => (
                                            <div key={si}>
                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em] pb-2 mb-4 border-b border-slate-100">{section.title}</h3>
                                                <div className={cn('grid gap-3', section.cols === 1 ? 'grid-cols-1' : section.cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : section.cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
                                                    {section.fields.map((f, fi) => (
                                                        <div key={fi} className={f.fullWidth ? 'col-span-full' : ''}>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{f.label}</span>
                                                            {f.type === 'textarea' ? (
                                                                <textarea
                                                                    value={intakeForm[f.id] || ''}
                                                                    onChange={(e) => setIntakeForm({...intakeForm, [f.id]: e.target.value})}
                                                                    rows={3}
                                                                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 resize-none transition-all"
                                                                />
                                                            ) : f.type === 'select' ? (
                                                                <select
                                                                    value={intakeForm[f.id] || ''}
                                                                    onChange={(e) => setIntakeForm({...intakeForm, [f.id]: e.target.value})}
                                                                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-300 transition-all min-h-[36px]"
                                                                >
                                                                    {f.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type={f.type === 'date' ? 'date' : 'text'}
                                                                    value={intakeForm[f.id] || ''}
                                                                    onChange={(e) => setIntakeForm({...intakeForm, [f.id]: e.target.value})}
                                                                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all min-h-[36px]"
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : intakeData ? (
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Intake File</h2>
                                        <p className="text-xs text-slate-400 mt-0.5">Clinical intake record — read only</p>
                                    </div>
                                    <div className="p-8 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar space-y-8">
                                        {[
                                            { title: '01 · Administrative & Demographics', cols: 3, fields: [
                                                { label: 'Full Name', val: intakeData.full_name },
                                                { label: 'Date of Birth', val: intakeData.date_of_birth },
                                                { label: 'Gender / Pronouns', val: intakeData.gender_pronouns },
                                                { label: 'Marital Status', val: intakeData.marital_status },
                                                { label: 'Occupation', val: intakeData.occupation },
                                                { label: 'Nationality', val: intakeData.nationality },
                                                { label: 'Place of Residence', val: intakeData.place_of_residence },
                                                { label: 'Source of Referral', val: intakeData.source_of_referral },
                                                { label: 'Date of Admission', val: intakeData.date_of_admission },
                                            ]},
                                            { title: '02 · Clinical Presentation', cols: 1, fields: [
                                                { label: 'Chief Complaint (Patient)', val: intakeData.chief_complaint_patient },
                                                { label: 'Chief Complaint (Informant)', val: intakeData.chief_complaint_informant },
                                                { label: 'Onset & Duration', val: intakeData.onset_and_duration },
                                            ]},
                                            { title: '03 · History of Presenting Illness', cols: 3, fields: [
                                                { label: 'Onset Mode', val: intakeData.hpi_onset },
                                                { label: 'Clinical Course', val: intakeData.hpi_course },
                                                { label: 'Duration', val: intakeData.hpi_duration },
                                                { label: 'Precipitating Factors', val: intakeData.hpi_precipitating },
                                                { label: 'Symptoms', val: intakeData.hpi_symptoms },
                                                { label: 'Treatment Received', val: intakeData.hpi_treatment_received },
                                                { label: 'Functional Impact', val: intakeData.hpi_impact_functioning },
                                                { label: 'Negative History', val: intakeData.hpi_negative_history },
                                                { label: 'Review of Systems', val: intakeData.hpi_review_of_systems },
                                            ]},
                                            { title: '04 · Past Psychiatric Profile', cols: 2, fields: [
                                                { label: 'Previous Episodes', val: intakeData.past_psych_episodes },
                                                { label: 'Past Hospitalisations', val: intakeData.past_hospitalisations },
                                                { label: 'Past Treatments', val: intakeData.past_treatments },
                                                { label: 'MH Services Used', val: intakeData.past_mh_services },
                                                { label: 'Suicide / Self-Harm', val: intakeData.suicide_self_harm },
                                                { label: 'Violence / Aggression', val: intakeData.violence_history },
                                            ]},
                                            { title: '05 · General Medical Status', cols: 3, fields: [
                                                { label: 'Childhood Illnesses', val: intakeData.childhood_illnesses },
                                                { label: 'Adult Illnesses', val: intakeData.adult_illnesses },
                                                { label: 'Surgeries', val: intakeData.surgeries },
                                                { label: 'Current Medical Conditions', val: intakeData.current_medical },
                                                { label: 'Allergies', val: intakeData.allergies },
                                                { label: 'Current Medications', val: intakeData.current_medications },
                                            ]},
                                            { title: '06 · Personal & Developmental History', cols: 4, fields: [
                                                { label: 'Pregnancy History', val: intakeData.birth_pregnancy },
                                                { label: 'Delivery Details', val: intakeData.birth_delivery },
                                                { label: 'Developmental Milestones', val: intakeData.developmental_milestones },
                                                { label: 'Childhood Temperament', val: intakeData.childhood_temperament },
                                                { label: 'Separation Anxiety', val: intakeData.childhood_separation },
                                                { label: 'Abuse History', val: intakeData.childhood_abuse },
                                                { label: 'Neurotic Traits', val: intakeData.childhood_neurotic },
                                                { label: 'Other Observations', val: intakeData.childhood_other },
                                            ]},
                                            { title: '07 · Socio-Occupational Log', cols: 2, fields: [
                                                { label: 'Academic Institution', val: intakeData.education_school },
                                                { label: 'Highest Qualification', val: intakeData.education_qualification },
                                                { label: 'Academic Performance', val: intakeData.education_performance },
                                                { label: 'Behavioural Report', val: intakeData.education_behaviour },
                                                { label: 'Peer Relationships', val: intakeData.education_relationships },
                                                { label: 'Employment History', val: intakeData.occupational_history },
                                                { label: 'Work Stressors', val: intakeData.occupational_other },
                                                { label: 'Military Service', val: intakeData.military_service },
                                                { label: 'Financial / Housing', val: intakeData.financial_housing },
                                                { label: 'Legal / Forensic', val: intakeData.forensic_history },
                                            ]},
                                            { title: '08 · Family & Interpersonal Dynamics', cols: 3, fields: [
                                                { label: 'Genogram Details', val: intakeData.family_genogram },
                                                { label: 'Family Structure', val: intakeData.family_structure },
                                                { label: 'Psychiatric History (Family)', val: intakeData.family_psych_illness },
                                                { label: 'Medical History (Family)', val: intakeData.family_medical },
                                                { label: 'Substance Use (Family)', val: intakeData.family_substance },
                                                { label: 'Family Dynamics', val: intakeData.family_dynamics },
                                                { label: 'Suicide History (Family)', val: intakeData.family_suicide },
                                                { label: 'Substance — Alcohol', val: intakeData.substance_alcohol },
                                                { label: 'Substance — Tobacco', val: intakeData.substance_tobacco },
                                                { label: 'Substance — Other', val: intakeData.substance_other },
                                                { label: 'Relationship History', val: intakeData.relationship_history },
                                                { label: 'Current Relationship', val: intakeData.relationship_current },
                                            ]},
                                            { title: '09 · Premorbid Personality & Conclusion', cols: 3, fields: [
                                                { label: 'Baseline Mood', val: intakeData.premorbid_mood },
                                                { label: 'Core Traits', val: intakeData.premorbid_traits },
                                                { label: 'Social Patterns', val: intakeData.premorbid_relationships },
                                                { label: 'Leisure Activity', val: intakeData.premorbid_leisure },
                                                { label: 'Coping Mechanisms', val: intakeData.premorbid_coping },
                                                { label: 'Values / Beliefs', val: intakeData.premorbid_values },
                                                { label: 'Habits / Routine', val: intakeData.premorbid_habits },
                                                { label: 'Self Concept', val: intakeData.premorbid_self_concept },
                                                { label: 'Social Judgement', val: intakeData.premorbid_judgement },
                                                { label: 'Final Clinical History Summary', val: intakeData.history_summary },
                                            ]},
                                        ].map((section, si) => (
                                            <div key={si}>
                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em] pb-2 mb-4 border-b border-slate-100">{section.title}</h3>
                                                <div className={cn('grid gap-3', section.cols === 1 ? 'grid-cols-1' : section.cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : section.cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
                                                    {section.fields.map((f, fi) => (
                                                        <div key={fi}>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{f.label}</span>
                                                            <p className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 min-h-[36px] leading-relaxed">{f.val || '—'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            ) : (
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Intake File</h2>
                                            <p className="text-xs text-slate-400 mt-0.5">No intake record found for this patient</p>
                                        </div>
                                        <button
                                            onClick={() => setIsAddingIntake(true)}
                                            className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-200"
                                        >
                                            <Plus size={14} /> Add Intake File
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center justify-center py-24 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-5 border border-slate-100">
                                            <Shield size={32} strokeWidth={1.5} />
                                        </div>
                                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No intake record</p>
                                        <p className="text-xs text-slate-400 mt-2">Click "Add Intake File" to create a clinical intake record for {patient?.full_name}.</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'Sessions' && (
                        <motion.div
                            key="sessions"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg flex min-h-[750px] relative"
                        >
                            {/* Left Sidebar: Session List */}
                            <div className="w-[380px] border-r border-slate-100 flex flex-col bg-slate-50/30">
                                <div className="p-8 border-b border-slate-100 bg-white">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-black text-slate-900">Timeline</h3>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                                            {sessions.length} Sessions
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                        <input 
                                            type="text" 
                                            placeholder="Filter records..."
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {sessionsLoading && sessions.length === 0 ? (
                                        <div className="py-20 text-center">
                                            <Loader2 size={24} className="animate-spin text-slate-300 mx-auto" />
                                        </div>
                                    ) : sessions.length === 0 ? (
                                        <div className="py-20 text-center px-6">
                                            <AlertCircle size={32} className="text-slate-200 mx-auto mb-4" />
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No clinical sessions</p>
                                        </div>
                                    ) : (
                                        sessions.map((session, idx) => (
                                            <button
                                                key={session.id}
                                                onClick={() => setSelectedSessionId(session.id)}
                                                className={cn(
                                                    "w-full p-4 rounded-lg text-left transition-all border flex flex-col gap-2 group/item",
                                                    selectedSessionId === session.id 
                                                        ? "bg-slate-50 border-indigo-200 shadow-sm ring-1 ring-indigo-50" 
                                                        : "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-200"
                                                )}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest mb-1 transition-colors",
                                                            selectedSessionId === session.id ? "text-indigo-500" : "text-slate-400"
                                                        )}>Session #{session.session_number || sessions.length - idx}</span>
                                                        <span className="text-sm font-black text-slate-800">
                                                            {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <ArrowUpRight size={14} className={cn("transition-all", selectedSessionId === session.id ? "text-indigo-400" : "text-slate-300 opacity-0 group-hover/item:opacity-100")} />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {(session.start_time || session.end_time) ? (
                                                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-200/50 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-wider">
                                                            <Clock size={10} /> 
                                                            {session.start_time ? new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'} 
                                                            {' - '} 
                                                            {session.end_time ? new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-200/50 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-wider">
                                                            <Clock size={10} /> {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-100/50 rounded-lg text-[8px] font-black text-indigo-500 uppercase tracking-wider">
                                                        Ver {session.version}
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Right Side: Detail View / Editor */}
                            <div className="flex-1 flex flex-col bg-white overflow-hidden">
                                {currentSession ? (
                                    <>
                                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800 leading-none">Session Record</h3>
                                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
                                                        Clinical Data Entry
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <AnimatePresence>
                                                    {saveSuccess && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, x: 20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: 20 }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold uppercase tracking-wider border border-emerald-200"
                                                        >
                                                            <CheckCircle2 size={12} /> Saved
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                <button
                                                    onClick={handleSaveSession}
                                                    disabled={isSaving}
                                                    className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold uppercase tracking-wider text-[10px] hover:bg-slate-900 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                                                >
                                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                    Save Record
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-slate-50/30">
                                            {/* Top Meta Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                {[
                                                    { label: 'Date', value: new Date(currentSession?.start_time || currentSession?.date).toLocaleDateString(), icon: Calendar },
                                                    { label: 'Start Time', value: currentSession?.start_time ? new Date(currentSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--', icon: Clock },
                                                    { label: 'End Time', value: currentSession?.end_time ? new Date(currentSession.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--', icon: Clock },
                                                    { label: 'Duration', value: (currentSession?.time_duration || 0) < 60 ? `${Math.floor(currentSession?.time_duration || 0)} secs` : `${Math.floor((currentSession?.time_duration || 0) / 60)} mins`, icon: Activity },
                                                    { label: 'Session #', value: currentSession?.session_number || '--', icon: Hash }
                                                ].map((stat, i) => (
                                                    <div key={i} className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col items-start">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <stat.icon size={12} className="text-slate-400" />
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-800">{stat.value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Flags Data Block */}
                                            {currentSession?.flags_data && (
                                                <div className="p-4 bg-white border border-rose-200 rounded-lg shadow-sm">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <AlertCircle size={14} className="text-rose-500" />
                                                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Clinical Flags</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentSession.flags_data.split(',').map((flag, idx) => {
                                                            const parts = flag.split(':');
                                                            const name = parts[0]?.trim();
                                                            return (
                                                                <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-md text-[11px] font-semibold text-rose-700">
                                                                    <span>{name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SOAP Editor Grid */}
                                            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                                    <ClipboardList size={14} className="text-indigo-600" />
                                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">SOAP Notes</h4>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {[
                                                        { key: 'subjective', label: 'Subjective' },
                                                        { key: 'objective', label: 'Objective' },
                                                        { key: 'assessment', label: 'Assessment' },
                                                        { key: 'plan', label: 'Plan' }
                                                    ].map((soap) => (
                                                        <div key={soap.key} className="space-y-1.5">
                                                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-1">{soap.label}</label>
                                                            <textarea
                                                                value={editorData[soap.key]}
                                                                onChange={(e) => setEditorData(prev => ({ ...prev, [soap.key]: e.target.value }))}
                                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all auto-resize-textarea overflow-hidden min-h-[100px]"
                                                                placeholder={`Enter ${soap.label.toLowerCase()} details...`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* AI Analysis Sections */}
                                            <div className="flex flex-col gap-6">
                                                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <Mic size={14} className="text-indigo-600" />
                                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Transcript</span>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        value={editorData.transcript}
                                                        onChange={(e) => setEditorData(prev => ({ ...prev, transcript: e.target.value }))}
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all auto-resize-textarea overflow-hidden min-h-[100px]"
                                                        placeholder="No transcript available..."
                                                    />
                                                </div>

                                                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <FileText size={14} className="text-indigo-600" />
                                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Summary</span>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        value={editorData.summary}
                                                        onChange={(e) => setEditorData(prev => ({ ...prev, summary: e.target.value }))}
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all auto-resize-textarea overflow-hidden min-h-[100px]"
                                                        placeholder="No summary available..."
                                                    />
                                                </div>
                                            </div>

                                            {/* Clinician Protected Sections */}
                                            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                                    <Shield size={14} className="text-indigo-600" />
                                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Clinician Insights</h4>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-1">Treatment Plan</label>
                                                        <textarea
                                                            value={editorData.treatment_plan}
                                                            onChange={(e) => setEditorData(prev => ({ ...prev, treatment_plan: e.target.value }))}
                                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all auto-resize-textarea overflow-hidden min-h-[100px]"
                                                            placeholder="Proposed treatment plan..."
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-1">Private Notes</label>
                                                        <textarea
                                                            value={editorData.notes}
                                                            onChange={(e) => setEditorData(prev => ({ ...prev, notes: e.target.value }))}
                                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all auto-resize-textarea overflow-hidden min-h-[100px] italic"
                                                            placeholder="Internal clinician observations..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                                        <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                                            <FileText size={24} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800">Select a Session</h3>
                                        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                                            Choose a record from the timeline to view details.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'History' && (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10 min-h-[600px]"
                        >
                            <div className="flex items-center gap-4 mb-10">
                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                                    <History size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Version Audit Trail</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Immutable Revision Log • Legal Compliance Documentation</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {sessions.length === 0 ? (
                                    <div className="py-20 text-center">
                                        <History size={48} className="text-slate-200 mx-auto mb-4" />
                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">No revision history found</h4>
                                    </div>
                                ) : (
                                    sessions.map((session, idx) => (
                                        <div key={session.id} className="border border-slate-100 rounded-[2.5rem] overflow-hidden hover:shadow-lg transition-all">
                                            <div className="px-8 py-5 bg-slate-50/50 flex items-center justify-between border-b border-slate-50">
                                                <div className="flex items-center gap-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Session No.</span>
                                                        <span className="text-base font-black text-slate-800">#{session.session_number || sessions.length - idx}</span>
                                                    </div>
                                                    <div className="w-px h-6 bg-slate-200" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Primary Record Date</span>
                                                        <span className="text-sm font-bold text-slate-700">{new Date(session.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                                    {session.version} Iterations Recorded
                                                </span>
                                            </div>
                                            <div className="p-8 bg-white">
                                                {/* In a real implementation, we would map over the session versions here */}
                                                <div className="space-y-3">
                                                    {[...Array(session.version)].map((_, vIdx) => (
                                                        <div key={vIdx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all group cursor-pointer border border-transparent hover:border-slate-200">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                                                    <FileText size={18} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-800">Backup_Version_{session.version - vIdx}.log</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated Snapshot • {new Date(session.updated_at || session.date).toLocaleTimeString()}</p>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={() => setViewingBackup({ session, versionStr: `Backup_Version_${session.version - vIdx}.log` })}
                                                                className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 group-hover:border-indigo-200 shadow-sm"
                                                            >
                                                                Review Backup
                                                            </button>
                                                        </div>
                                                    )).reverse()}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}


                </AnimatePresence>
            </div>

            {/* Intake Confirmation Modal */}
            {showIntakeConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="px-7 pt-7 pb-5 flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight">Confirm Before Saving</h3>
                                <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                                    Once saved, <span className="font-bold text-slate-700">this intake record cannot be edited</span> in the future. It will be stored as a permanent clinical baseline.
                                </p>
                            </div>
                        </div>

                        {/* Warning box */}
                        <div className="mx-7 mb-6 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                            <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-1">⚠ Please recheck before confirming</p>
                            <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
                                <li>All patient demographics are accurate</li>
                                <li>Clinical history and complaints are complete</li>
                                <li>All fields have been reviewed</li>
                            </ul>
                        </div>

                        {/* Action buttons */}
                        <div className="px-7 pb-7 flex gap-3">
                            <button
                                onClick={() => setShowIntakeConfirm(false)}
                                className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                            >
                                Go Back & Review
                            </button>
                            <button
                                onClick={() => { setShowIntakeConfirm(false); handleSaveIntake(); }}
                                className="flex-1 px-5 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
                            >
                                <Save size={13} /> Confirm & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backup Review Modal */}
            {viewingBackup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 lg:p-8">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{viewingBackup.versionStr}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Read-only historical record for Session #{viewingBackup.session.session_number}</p>
                            </div>
                            <button
                                onClick={() => setViewingBackup(null)}
                                className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Action</span>
                                    <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><History size={14} className="text-indigo-500" /> System Backup</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Timestamp</span>
                                    <span className="text-sm font-bold text-slate-800">{new Date(viewingBackup.session.updated_at || viewingBackup.session.date).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Status</span>
                                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex w-fit items-center gap-1"><CheckCircle2 size={12} /> Verified</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Author</span>
                                    <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><User size={14} className="text-slate-400" /> Dr. {authUser?.name || 'Practitioner'}</span>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                    <ClipboardList size={14} className="text-indigo-600" />
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">SOAP Data Snapshot</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { label: 'Subjective', value: viewingBackup.session.soap_notes?.subjective },
                                        { label: 'Objective', value: viewingBackup.session.soap_notes?.objective },
                                        { label: 'Assessment', value: viewingBackup.session.soap_notes?.assessment },
                                        { label: 'Plan', value: viewingBackup.session.soap_notes?.plan }
                                    ].map(soap => (
                                        <div key={soap.label}>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{soap.label}</span>
                                            <div className="text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 min-h-[80px]">
                                                {soap.value || <span className="text-slate-400 italic">No entry recorded...</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                    <Shield size={14} className="text-indigo-600" />
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Clinical Notes & Plan</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Treatment Plan</span>
                                        <div className="text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 min-h-[80px]">
                                            {viewingBackup.session.treatment_plan || <span className="text-slate-400 italic">No entry recorded...</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Private Notes</span>
                                        <div className="text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 min-h-[80px] italic">
                                            {viewingBackup.session.notes || <span className="text-slate-400 italic">No entry recorded...</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setViewingBackup(null)}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
                            >
                                <CheckCircle2 size={14} /> Close Backup
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
