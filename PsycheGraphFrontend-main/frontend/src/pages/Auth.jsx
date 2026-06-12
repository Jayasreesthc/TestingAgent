import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail,
    Lock,
    User,
    Building2,
    Eye,
    EyeOff,
    Loader2,
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    Plus,
    Activity,
    Phone,
    Upload,
    AlertCircle,
    Image as ImageIcon
} from 'lucide-react';
import { login, loginHospital, clearError, registerHospital, logout } from '../store/slices/AllLoginSlice';
import { useNavigate, Link } from 'react-router-dom';
import loginSide from '../assets/new-logo.png';


export default function Auth() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [showPassword, setShowPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const [license_key, setLicenseKey] = useState(false);

    const [loginData, setLoginData] = useState({
        email: '',
        password: ''
    });

    const [registerData, setRegisterData] = useState({
        email: '',
        full_name: '',
        password: '',
        license_key: '',
        phone_number: '',
        logo: null
    });

    useEffect(() => {
        dispatch(clearError());
        return () => dispatch(clearError());
    }, [dispatch, mode]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            // Role restriction is handled in Redux layer via portal flag
            await dispatch(login({ ...loginData, portal: 'common' })).unwrap();
        } catch (err) { }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(registerData).forEach(key => {
            if (registerData[key] !== null) {
                data.append(key, registerData[key]);
            }
        });

        try {
            await dispatch(registerHospital(data)).unwrap();
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setMode('login');
            }, 2000);
        } catch (err) { }
    };

    if (success) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#070b10]">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-6 p-8 md:p-12 bg-[#0f172a] rounded-3xl shadow-2xl max-w-md w-full mx-4 border border-slate-800"
                >
                    <div className="h-24 w-24 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                        <CheckCircle2 size={48} className="animate-bounce" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Account Created!</h2>
                        <p className="text-slate-400">Switching to login...</p>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2 }}
                            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-[#070b10] font-sans overflow-x-hidden">
            {/* Left Side - Visual Panel (Exact Match Style) */}
            <div className="w-full md:w-1/2 h-[40vh] md:h-screen relative flex flex-col items-center justify-center p-6 md:p-8 bg-[#070b10] border-b md:border-b-0 md:border-r border-white/5 overflow-hidden">
                <div className="absolute inset-0 z-0 overflow-hidden bg-[#070b1]">
                    <motion.div
                        animate={{
                            scale: [0.8, 0.85, 0.8], // Reduced scale to make image smaller
                        }}
                        transition={{
                            duration: 3, // slightly slower for a calmer feel
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 z-0 h-full w-full flex items-center justify-center"
                    >
                        <img
                            src={loginSide}
                            alt="Brain Glow"
                            className="max-w-[85%] max-h-[85%] object-contain opacity-50"
                        />
                    </motion.div>

                    <motion.div
                        animate={{
                            opacity: [0.2, 0.5, 0.2], // softer glow
                            scale: [0.8, 0.88, 0.8], // matching image scale
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 z-1 bg-[radial-gradient(circle_at_50%_50%,rgba(22, 192, 226, 0.25),transparent_70%)] mix-blend-screen blur-2xl"
                    />

                    <div className="absolute inset-0 z-2 bg-gradient-to-b from-[#062F3F]/20 via-transparent to-[#062F3F]/40" />
                </div>

                {/* Visual Content */}
                <div className="relative z-10 w-full max-w-sm md:max-w-lg flex flex-col items-center text-center">
                    {/* <div className="mb-4 md:mb-6">
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-[#070b10] rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-105">
                            <Activity className="text-white w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
                        </div>
                    </div> */}

                    <div className="space-y-2 md:space-y-3">
                        <h1 className="text-2xl md:text-4xl font-serif font-black text-white tracking-normal mb-1 drop-shadow-xl">
                            PsycheGraph
                        </h1>
                        <p className="text-white text-sm md:text-lg font-normal tracking-wide max-w-[280px] md:max-w-sm mx-auto leading-tight opacity-90">
                            Advanced clinical operations platform for modern mental health practices
                        </p>
                    </div>
                </div>

                {/* Footer Copy */}
                <div className="absolute bottom-6 left-0 right-0 text-center z-10">
                    <p className="text-slate-200 text-[10px] font-medium uppercase tracking-[0.2em] opacity-40">
                        © 2026 PsycheGraph. All rights reserved.
                    </p>
                </div>
            </div>

            {/* Right Side - Form Panel (Exact Match Style) */}
            <div className="w-full md:w-1/2 min-h-[60vh] md:h-screen bg-white flex items-center justify-center p-6 md:p-8 lg:p-12 relative overflow-hidden">
                <div className="w-full max-w-md">
                    <AnimatePresence mode="wait">
                        {mode === 'login' ? (
                            <motion.div
                                key="login-form"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-6"
                            >
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-serif font-bold text-[#0f172a] mb-1">Welcome back</h2>
                                    <p className="text-slate-500 font-medium text-base">Sign in to your clinical operations portal</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-5">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5 z-20 pointer-events-none" />
                                            <input
                                                type="email"
                                                required
                                                value={loginData.email}
                                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                                autoComplete="off"
                                                className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3.5 pl-12 pr-5 text-[#0f172a] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-base shadow-sm"
                                                placeholder="Enter your email"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 relative">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-sm font-bold text-slate-700">Password</label>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5 z-20 pointer-events-none" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                value={loginData.password}
                                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                                autoComplete="new-password"
                                                className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3.5 pl-12 pr-11 text-[#0f172a] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-base shadow-sm"
                                                placeholder="Enter your password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                                            </button>
                                        </div>
                                        {/* <div className="flex justify-end pt-0.5">
                                            <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                                Forgot password?
                                            </button>
                                        </div> */}
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl flex items-center gap-3 border border-red-100"
                                            >
                                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                                                <span>{typeof error === 'string' ? error : (error.msg || JSON.stringify(error))}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full relative py-3.5 px-8 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white font-extrabold text-base shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all active:scale-[0.98] disabled:opacity-70 group flex items-center justify-center gap-3"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={22} /> : (
                                            <>
                                                <span>Sign In</span>
                                                <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMode('register')}
                                        className="w-full py-2 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-[#0f172a] transition-all "
                                    >
                                        Don't have an account? Sign Up
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="register-form"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-6"
                            >
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-serif font-bold text-[#0f172a] mb-1">Create account</h2>
                                    <p className="text-slate-500 font-medium text-base">Register your clinical facility</p>
                                </div>

                                <form onSubmit={handleRegister} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                                            <div className="relative">
                                                <User className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 z-20" />
                                                <input
                                                    type="text"
                                                    required
                                                    value={registerData.full_name}
                                                    onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                                                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3 pl-11 pr-5 text-[#0f172a] font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-base"
                                                    placeholder="Enter your full name"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 z-20" />
                                                <input
                                                    type="email"
                                                    required
                                                    value={registerData.email}
                                                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                                    autoComplete="off"
                                                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3 pl-11 pr-5 text-[#0f172a] font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-base"
                                                    placeholder="Enter your email"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1">License Key</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 z-20" />
                                                <input
                                                    type={license_key ? "text" : "password"}
                                                    required
                                                    value={registerData.license_key}
                                                    onChange={(e) => setRegisterData({ ...registerData, license_key: e.target.value })}
                                                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3 pl-11 pr-11 text-[#0f172a] font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm uppercase tracking-wider text-base"
                                                    placeholder="XXXX-XXXX-XXXX"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setLicenseKey(!license_key)}
                                                    className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-400"
                                                >
                                                    {license_key ? <Eye size={18} /> : <EyeOff size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 z-20" />
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    value={registerData.password}
                                                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                                    autoComplete="new-password"
                                                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3 pl-11 pr-11 text-[#0f172a] font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-base"
                                                    placeholder="Enter your password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-400"
                                                >
                                                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Phone Number</label>
                                            <div className="relative">
                                                <Phone className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 z-20" />
                                                <input
                                                    type="tel"
                                                    maxLength={10}
                                                    value={registerData.phone_number}
                                                    onChange={(e) => setRegisterData({ ...registerData, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl py-3 pl-11 pr-5 text-[#0f172a] font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-base"
                                                    placeholder="9876543210"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Hospital Logo</label>
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    id="register-logo"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => setRegisterData({ ...registerData, logo: e.target.files[0] })}
                                                />
                                                <label
                                                    htmlFor="register-logo"
                                                    className="w-full flex items-center justify-between bg-[#f8fafc] border border-slate-100 rounded-xl py-3 px-11 cursor-pointer hover:bg-slate-50 transition-all shadow-sm"
                                                >
                                                    <div className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400">
                                                        <Upload size={18} />
                                                    </div>
                                                    <span className="text-slate-400 text-base font-medium truncate">
                                                        {registerData.logo ? registerData.logo.name : "Upload Logo"}
                                                    </span>
                                                    {registerData.logo && (
                                                        <div className="shrink-0 ml-2">
                                                            <ImageIcon size={18} className="text-blue-500" />
                                                        </div>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-3"
                                            >
                                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                                <span>{typeof error === 'string' ? error : (error.msg || JSON.stringify(error))}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white font-extrabold text-base rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all disabled:opacity-70 active:scale-95"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={22} /> : "Create Account"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMode('login')}
                                        className="w-full py-1 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-[#0f172a] transition-all"
                                    >
                                        Already have an account? Sign In
                                    </button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Global Styles for Fonts */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
                .font-serif { font-family: 'Playfair Display', serif; }
            ` }} />
        </div>
    );
}
