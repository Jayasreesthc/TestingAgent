import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, loginHospital, logout, clearError } from '../store/slices/AllLoginSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Mail, Lock, Loader2, Eye, EyeOff, Sparkles, UserPlus, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login({
    showRegister = true,
    allowedRoles = [],
    portalTitle = "Enterprise Clinical Documentation Platform",
    isHospitalPortal = false
}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [roleError, setRoleError] = useState(null);
    const dispatch = useDispatch();
    const { loading, error: authError } = useSelector((state) => state.auth);

    useEffect(() => {
        dispatch(clearError());
        return () => dispatch(clearError());
    }, [dispatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setRoleError(null);

        const loginThunk = isHospitalPortal ? loginHospital : login;
        const resultAction = await dispatch(loginThunk({ email, password, portal: 'admin' }));

        if (login.fulfilled.match(resultAction) || loginHospital.fulfilled.match(resultAction)) {
            const userData = resultAction.payload;
            const userRole = userData.role || userData.user?.role;

            if (allowedRoles.length > 0 && userRole) {
                const normalizedRole = userRole.toUpperCase();
                if (!allowedRoles.includes(normalizedRole)) {
                    await dispatch(logout());
                    setRoleError(`Access Denied: This portal is reserved for ${allowedRoles.map(r => r.replace('_', ' ')).join(' & ')} only.`);
                }
            }
        }
    };

    const error = authError || roleError;

    // Check if this is the Super Admin login
    const isSuperAdmin = allowedRoles.includes('SUPER_ADMIN');

    if (isSuperAdmin) {
        return (
            <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
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
                        className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-400/20 to-purple-400/20 rounded-full blur-3xl"
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
                        className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl"
                    />
                </div>

                <div className="relative min-h-screen flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-md w-full"
                    >
                        {/* Logo Section */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="text-center mb-8"
                        >
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl text-white shadow-2xl shadow-primary-500/50 mb-6 relative"
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-400/50 to-purple-400/50 blur-xl"
                                />
                                <Activity size={32} className="relative z-10 md:w-10 md:h-10" />
                            </motion.div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-primary-600 to-slate-900 tracking-tight mb-2">
                                PsycheGraph
                            </h1>
                            <p className="text-sm md:text-base text-slate-600 font-medium flex items-center justify-center gap-2 px-4">
                                <Sparkles size={14} className="text-primary-500 md:w-4 md:h-4" />
                                {portalTitle}
                            </p>
                        </motion.div>
                        {/* Main Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="relative backdrop-blur-xl bg-white/80 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl border border-white/50"
                        >
                            {/* Glassmorphism overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-white/30 rounded-3xl" />

                            <div className="relative z-10">
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {/* Email Field */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="space-y-2"
                                    >
                                        <label className="block text-sm font-bold text-slate-700 ml-1">Email Address</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors w-5 h-5 z-20 pointer-events-none" />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                autoComplete="off"
                                                className="block w-full pl-11 md:pl-12 pr-4 py-3 md:py-3.5 bg-white/50 backdrop-blur-sm border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-slate-900 placeholder:text-slate-400 font-medium text-sm md:text-base"
                                                placeholder="name@organization.com"
                                            />
                                        </div>
                                    </motion.div>

                                    {/* Password Field */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="space-y-2"
                                    >
                                        <label className="block text-sm font-bold text-slate-700 ml-1">Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors w-5 h-5 z-20 pointer-events-none" />
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                autoComplete="new-password"
                                                className="block w-full pl-11 md:pl-12 pr-11 md:pr-12 py-3 md:py-3.5 bg-white/50 backdrop-blur-sm border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-slate-900 placeholder:text-slate-400 font-medium text-sm md:text-base"
                                                placeholder="Enter your password"
                                            />
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.95 }}
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-primary-600 transition-colors"
                                            >
                                                {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                                            </motion.button>
                                        </div>
                                    </motion.div>

                                    {/* Error Message */}
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border-2 border-red-100"
                                        >
                                            {error}
                                        </motion.div>
                                    )}

                                    {/* Sign In Button */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                        type="submit"
                                        disabled={loading}
                                        className="w-full relative overflow-hidden py-3.5 md:py-4 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-4 focus:ring-primary-500/50 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-primary-500/30 group text-sm md:text-base"
                                    >
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                                            animate={{
                                                x: ['-100%', '100%']
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                ease: "linear"
                                            }}
                                        />
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            {loading ? (
                                                <Loader2 className="animate-spin" size={20} />
                                            ) : (
                                                <>
                                                    <span>Sign In</span>
                                                    <motion.span
                                                        animate={{ x: [0, 5, 0] }}
                                                        transition={{ duration: 1.5, repeat: Infinity }}
                                                    >
                                                        →
                                                    </motion.span>
                                                </>
                                            )}
                                        </span>
                                    </motion.button>
                                </form>

                                {/* Demo Accounts Section */}
                                {showRegister && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                        className="mt-8 pt-6 border-t-2 border-slate-200"
                                    >



                                    </motion.div>
                                )}
                            </div>
                        </motion.div>

                        {/* Footer */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="text-center text-xs text-slate-500 mt-6"
                        >
                            © 2026 PsycheGraph. All rights reserved.
                        </motion.p>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-slate-50 flex items-center justify-center p-4 md:p-6 lg:p-8">
            {/* Elegant Background Pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.05),transparent_50%)]" />
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(168,85,247,0.05),transparent_50%)]" />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.4, 0.3],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-[1000px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100 relative z-10"
            >
                {/* Left Side - Brand & Visuals */}
                <div className="hidden md:flex flex-col justify-between w-5/12 bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-opacity-20 mix-blend-soft-light"></div>

                    {/* Floating Orbs */}
                    <motion.div
                        animate={{ y: [0, -20, 0], opacity: [0.6, 0.8, 0.6] }}
                        transition={{ duration: 5, repeat: Infinity }}
                        className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-2xl"
                    />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
                                <Activity className="w-8 h-8 text-white" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">PsycheGraph</span>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-4xl font-extrabold leading-tight">
                                Clinical Excellence <br /> Redefined.
                            </h2>
                            <p className="text-indigo-100 text-lg leading-relaxed font-light opacity-90">
                                Streamline your operations with our advanced AI-powered documentation platform. Secure, efficient, and intelligent.
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 mt-auto">
                        <div className="flex items-center gap-4 text-sm text-indigo-200 font-medium">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-indigo-600 bg-indigo-400 flex items-center justify-center text-[10px] overflow-hidden`}>
                                        <div className="w-full h-full bg-indigo-300"></div>
                                    </div>
                                ))}
                            </div>
                            <p>Used by top clinicians globally</p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full md:w-7/12 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white relative">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-10 text-center md:text-left">
                            <h3 className="text-3xl font-bold text-slate-900 mb-3">Welcome Back</h3>
                            <p className="text-slate-500 font-medium flex items-center justify-center md:justify-start gap-2">
                                {portalTitle}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Email Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 z-20 pointer-events-none" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="off"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-semibold text-slate-700">Password</label>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5 z-20 pointer-events-none" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-600 text-sm overflow-hidden"
                                    >
                                        <div className="bg-red-100 p-1 rounded-full shrink-0">
                                            <ShieldCheck size={14} className="text-red-500" />
                                        </div>
                                        <p className="font-medium">
                                            {typeof error === 'string' ? error : (error.msg || JSON.stringify(error))}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                disabled={loading}
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin w-5 h-5" />
                                ) : (
                                    <>
                                        Sign In to Platform
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        {showRegister && (
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <p className="text-center text-slate-500 text-sm mb-4">Don't have an account?</p>
                                <Link
                                    to="/register"
                                    className="flex items-center justify-center w-full py-3.5 border-2 border-slate-100 rounded-xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-200 transition-all gap-2"
                                >
                                    <UserPlus className="w-5 h-5 text-indigo-500" />
                                    Create New Hospital Account
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-400 font-medium">
                © {new Date().getFullYear()} PsycheGraph. Secure HIPAA Compliant Platform.
            </p>
        </div>
    );
}
