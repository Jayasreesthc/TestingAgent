import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserPlus,
    Mail,
    Lock,
    User,
    Building2,
    Loader2,
    ChevronRight,
    ShieldCheck,
    AlertCircle,
    Eye,
    EyeOff,
    CheckCircle2,
    ArrowLeft,
    Phone,
    Upload,
    Image as ImageIcon
} from 'lucide-react';
import { registerHospital, clearError } from '../store/slices/AllLoginSlice';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    useEffect(() => {
        dispatch(clearError());
        return () => dispatch(clearError());
    }, [dispatch]);

    const [showPassword, setShowPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const [localError, setLocalError] = useState('');
    const [formData, setFormData] = useState({
        email: '',
        full_name: '',
        password: '',
        license_key: '',
        phone_number: '',
        logo: null
    });

    useEffect(() => {
        if (localError) setLocalError('');
    }, [formData.email]);

    const validateEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        dispatch(clearError());

        if (!validateEmail(formData.email)) {
            setLocalError('Please enter a valid email address.');
            return;
        }

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null) {
                data.append(key, formData[key]);
            }
        });

        try {
            await dispatch(registerHospital(data)).unwrap();
            setSuccess(true);
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            // Error managed by Redux
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-6 p-12 bg-white rounded-3xl shadow-xl max-w-md w-full mx-4"
                >
                    <div className="h-24 w-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircle2 size={48} className="animate-bounce" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Account Created!</h2>
                        <p className="text-slate-500 text-sm">Redirecting you to the login page...</p>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2 }}
                            className="h-full bg-emerald-500"
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-slate-50 flex items-center justify-center p-4 md:p-6 lg:p-8">
            {/* Background Pattern - Consistent with Login */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.05),transparent_50%)]" />
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(168,85,247,0.05),transparent_50%)]" />
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.4, 0.3] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-[1100px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col md:flex-row min-h-[650px] border border-slate-100 relative z-10"
            >
                {/* Left Side - Brand & Visuals */}
                <div className="hidden md:flex flex-col justify-between w-5/12 bg-gradient-to-br from-slate-900 to-slate-800 p-12 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-indigo-600/10 mix-blend-overlay"></div>

                    {/* Abstract Shapes */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10">
                        <Link to="/" className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-8 group">
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-medium">Back to Login</span>
                        </Link>

                        <div className="space-y-6">
                            <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-2">
                                <Building2 size={32} className="text-indigo-400" />
                            </div>
                            <h2 className="text-4xl font-extrabold leading-tight">
                                Partner with <br /> <span className="text-indigo-400">PsycheGraph</span>
                            </h2>
                            <p className="text-slate-300 text-lg leading-relaxed font-light">
                                Register your hospital authority to access our enterprise-grade clinical documentation and management suite.
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 mt-auto">
                        <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                            <div className="flex items-start gap-4">
                                <ShieldCheck size={24} className="text-emerald-400 shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-white text-sm">Enterprise License Required</h4>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        Registration is restricted to authorized hospital administrators with a valid license key.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Register Form */}
                <div className="w-full md:w-7/12 p-8 md:p-12 lg:p-12 flex flex-col justify-center bg-white relative">
                    <div className="max-w-lg mx-auto w-full">
                        <div className="mb-8">
                            <h3 className="text-3xl font-bold text-slate-900 mb-2">Register Authority</h3>
                            <p className="text-slate-500">Create a new administrative account for your facility.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <AnimatePresence>
                                {(error || localError) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-600 text-sm overflow-hidden"
                                    >
                                        <AlertCircle size={18} className="shrink-0" />
                                        <p className="font-medium">{localError || (typeof error === 'string' ? error : (error?.msg || JSON.stringify(error)))}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 pointer-events-none" />
                                        <input
                                            required
                                            type="text"
                                            placeholder="Enter Full Name"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 pointer-events-none" />
                                        <input
                                            required
                                            type="email"
                                            placeholder="admin@hospital.com"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Password */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 pointer-events-none" />
                                        <input
                                            required
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* License Key */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">License Key</label>
                                    <div className="relative group">
                                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 pointer-events-none" />
                                        <input
                                            required
                                            type="text"
                                            placeholder="Valid License Key"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase tracking-wider"
                                            value={formData.license_key}
                                            onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Phone Number */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Phone Number</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 pointer-events-none" />
                                        <input
                                            type="tel"
                                            maxLength="10"
                                            placeholder="1234567890"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            value={formData.phone_number}
                                            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        />
                                    </div>
                                </div>

                                {/* Logo Upload */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Hospital Logo</label>
                                    <div className="relative group">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="file"
                                                id="logo-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => setFormData({ ...formData, logo: e.target.files[0] })}
                                            />
                                            <label
                                                htmlFor="logo-upload"
                                                className="flex-1 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-all group-focus-within:ring-2 group-focus-within:ring-indigo-500/20 group-focus-within:border-indigo-500"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Upload size={18} className="text-slate-400" />
                                                    <span className="text-slate-500 text-sm font-medium">
                                                        {formData.logo ? formData.logo.name : "Upload Logo"}
                                                    </span>
                                                </div>
                                                {formData.logo && <ImageIcon size={18} className="text-indigo-500" />}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                disabled={loading}
                                type="submit"
                                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin w-5 h-5" />
                                ) : (
                                    <>
                                        Create Hospital Authority
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </motion.button>

                            <div className="text-center mt-4 md:hidden">
                                <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                                    Already have an account? Sign In
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

