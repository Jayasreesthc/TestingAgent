import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHospitalProfile, updateHospitalProfile, clearOrgError } from '../../store/slices/OrgSlice';
import {
    Building2,
    Mail,
    Phone,
    MapPin,
    Upload,
    Save,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Palette,
    Globe,
    Image as ImageIcon,
    Sparkles,
    X,
    Check
} from 'lucide-react';

// Toast Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border ${type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                }`}
        >
            {type === 'success' ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Check size={18} />
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                    <AlertCircle size={18} />
                </div>
            )}
            <div className="flex flex-col">
                <p className="font-bold text-sm leading-tight">{type === 'success' ? 'Success' : 'Error'}</p>
                <p className="text-xs opacity-90 font-medium mt-0.5">{message}</p>
            </div>
            <button onClick={onClose} className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors">
                <X size={16} />
            </button>
        </motion.div>
    );
};


// Convert raw base64 string or URL to a displayable src
// Convert raw base64 string or URL to a displayable src
function resolveLogoSrc(raw) {
    if (!raw) return null;

    if (typeof raw !== 'string') return null;
    let str = raw.trim();
    if (str.startsWith("b'") && str.endsWith("'")) str = str.slice(2, -1);
    if (str.startsWith('b"') && str.endsWith('"')) str = str.slice(2, -1);

    // Web URIs or Data URIs
    if (str.startsWith('data:') || str.startsWith('http://') || str.startsWith('https://')) {
        // Force direct backend IP calls to go through local proxy to avoid CORS/access issues
        if (str.includes('65.1.249.160') || str.includes('52.66.143.164')) {
            return str.replace(/https?:\/\/(65\.1\.249\.160|52\.66\.143\.164)/, '/api');
        }
        return str;
    }

    // Relative paths from backend (e.g., /media/..., /uploads/...)
    if (
        str.startsWith('/') ||
        str.startsWith('media/') ||
        str.startsWith('uploads/')
    ) {
        let path = str.startsWith('/') ? str : `/${str}`;

        // Handle case where backend already returned /api/...
        if (path.startsWith('/api/')) return path;

        // Use environment variable or default to /api proxy
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
        return `${baseUrl}${path}`;
    }

    // Must be a raw base64 string — detect MIME from magic bytes
    try {
        const header = str.substring(0, 12);
        let mime = 'image/png'; // default
        if (header.startsWith('/9j/')) mime = 'image/jpeg';
        else if (header.startsWith('iVBOR')) mime = 'image/png';
        else if (header.startsWith('PHN2') || header.startsWith('PD94')) mime = 'image/svg+xml';
        else if (header.startsWith('R0lG')) mime = 'image/gif';
        else if (header.startsWith('UklG')) mime = 'image/webp';
        else if (header.startsWith('AAAB')) mime = 'image/x-icon';
        return `data:${mime};base64,${str}`;
    } catch {
        return null;
    }
}

export default function Branding() {
    const dispatch = useDispatch();
    const { loading, error: orgError, currentOrg } = useSelector((state) => state.organizations);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        clinicName: '',
        org_name: '',
        email: '',
        phone: '',
        address: '',
        brandColor: '#4f46e5',
        logo: null,
    });

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);
    // Track locally-selected logo URL so we don't lose it when currentOrg updates after save
    const localLogoUrl = useRef(null);

    useEffect(() => {
        dispatch(fetchHospitalProfile());
        return () => dispatch(clearOrgError());
    }, [dispatch]);

    useEffect(() => {
        if (currentOrg) {
            setFormData({
                clinicName: currentOrg.full_name || currentOrg.name || '',
                email: currentOrg.email || '',
                phone: currentOrg.phone_number || currentOrg.phone || currentOrg.contact_number || '',
                address: currentOrg.address || '',
                brandColor: currentOrg.brand_color || currentOrg.brandColor || '#4f46e5',
                logo: null,
                org_name: currentOrg.org_name || currentOrg.full_name || currentOrg.name || ''
            });
            // If there's a locally-selected file (blob URL), keep it — don't replace with API value
            if (localLogoUrl.current) {
                setLogoPreview(localLogoUrl.current);
            } else {
                const rawLogo = currentOrg.logo || currentOrg.logo_url || currentOrg.profile_picture;
                const resolved = resolveLogoSrc(rawLogo);
                if (resolved) setLogoPreview(resolved);
            }
        }
    }, [currentOrg]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (e.g., 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast("File size too large. Please select an image under 2MB.", "error");
                return;
            }

            // Automate Base64 conversion
            setLogoFile(file); // Store actual File object for upload

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                setLogoPreview(base64String);
                localLogoUrl.current = base64String;
                showToast("Logo selected");
            };
            reader.readAsDataURL(file);
        }
    };


    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: null }));
        setLogoPreview(null);
        setLogoFile(null);
        localLogoUrl.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        try {
            // Only send fields supported by /admin/hospital/profile PUT endpoint
            const payload = {
                phone_number: formData.phone,
                address: formData.address,
                logo: logoFile // This is the File object or null
            };

            await dispatch(updateHospitalProfile(payload)).unwrap();
            setIsSaving(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            setIsSaving(false);
        }
    };

    const initials = formData.clinicName
        ? formData.clinicName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : 'CL';

    const PRESET_COLORS = [
        '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
        '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
    ];

    return (
        <div className="flex flex-col min-h-[calc(100vh-180px)] max-w-[1200px] mx-auto pb-10">

            {/* Header */}
            <div className="flex flex-col gap-1 px-1 mb-8">
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Settings</h1>
                <p className="text-[13px] text-slate-400 font-medium tracking-tight uppercase">Customize your clinic's visual identity</p>
            </div>

            {/* Error */}
            <AnimatePresence>
                {orgError && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 text-red-600 text-sm mb-6"
                    >
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p className="font-bold">{typeof orgError === 'string' ? orgError : (orgError.msg || JSON.stringify(orgError))}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">

                {/* ─── Left: Form ─── */}
                <div className="space-y-6">

                    {/* Clinic Identity Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Building2 size={17} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-[14px] font-black text-slate-800">Clinic Identity</h2>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Clinic Name */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinic Name</label>
                                <input
                                    type="text"
                                    name="clinicName"
                                    value={formData.clinicName}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:font-normal"
                                    placeholder="e.g. Sunrise Mental Health Clinic"
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed"
                                        placeholder="hello@clinic.com"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                <div className="relative">
                                    <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        maxLength={10}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setFormData(prev => ({ ...prev, phone: value }));
                                        }}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:font-normal"
                                        placeholder="9876543210"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                                <div className="relative">
                                    <MapPin size={15} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        rows={2}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:font-normal resize-none"
                                        placeholder="123 Healing Ave, City, State"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Logo Upload Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
                            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                                <ImageIcon size={17} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-[14px] font-black text-slate-800">Clinic Logo</h2>
                        </div>

                        <div className="p-6">
                            <input
                                ref={fileInputRef}
                                type="file"
                                id="logo-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />

                            {logoPreview ? (
                                <div className="flex items-center gap-6">
                                    <div className="relative group shrink-0">
                                        <img
                                            src={logoPreview}
                                            alt="Logo preview"
                                            className="h-24 w-24 object-contain rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-sm"
                                        />
                                        <button
                                            onClick={handleRemoveLogo}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-bold text-slate-700 mb-1">Logo uploaded</p>
                                            <p className="text-xs text-slate-400 mb-3">Hover the image to remove it</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label
                                                htmlFor="logo-upload"
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
                                            >
                                                Change Logo
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <label
                                    htmlFor="logo-upload"
                                    className="border-2 border-dashed border-slate-100 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 bg-slate-50/30 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all cursor-pointer group"
                                >
                                    <div className="p-3 bg-white shadow-sm rounded-xl text-slate-300 group-hover:text-indigo-500 transition-colors">
                                        <Upload size={24} strokeWidth={2} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">Click or drag to upload logo</p>
                                        <p className="text-[11px] font-medium text-slate-400 mt-1">PNG, JPG, SVG · Max 2MB · Recommended 512×512</p>
                                    </div>
                                </label>
                            )}
                        </div>
                    </motion.div>

                    {/* Brand Color Card (Commented out) */}
                    {/*
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
                            <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                                <Palette size={17} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-[14px] font-black text-slate-800">Brand Color</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-12 h-12 rounded-xl shadow-md border border-white shrink-0"
                                    style={{ backgroundColor: formData.brandColor }}
                                />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 mb-1.5">HEX VALUE</p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            name="brandColor"
                                            value={formData.brandColor}
                                            onChange={handleInputChange}
                                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-mono font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                        />
                                        <input
                                            type="color"
                                            value={formData.brandColor}
                                            onChange={(e) => setFormData(prev => ({ ...prev, brandColor: e.target.value }))}
                                            className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-transparent p-0.5"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">PRESETS</p>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setFormData(prev => ({ ...prev, brandColor: color }))}
                                            className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${formData.brandColor.toLowerCase() === color ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    */}
                </div>

                {/* ─── Right: Live Preview ─── */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 }}
                        className="sticky top-24"
                    >
                        {/* Preview Card */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <Sparkles size={17} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-[14px] font-black text-slate-800">Live Preview</h2>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Sidebar Preview */}
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Sidebar Brand</p>
                                    <div className="bg-[#062f3f] rounded-2xl p-4 flex items-center gap-3">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo"
                                                className="h-10 w-10 object-contain rounded-xl bg-white/10 p-1 shrink-0"
                                            />
                                        ) : (
                                            <div
                                                className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                                                style={{ backgroundColor: formData.brandColor }}
                                            >
                                                {initials}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-white font-black text-sm leading-tight truncate max-w-[160px]">
                                                {formData.clinicName || 'Your Clinic Name'}
                                            </p>
                                            <p className="text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded inline-block bg-blue-500/20 text-blue-300">ADMIN</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Avatar/Badge Preview */}
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Brand Badge</p>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg"
                                            style={{ backgroundColor: formData.brandColor }}
                                        >
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">{formData.clinicName || 'Your Clinic Name'}</p>
                                            {formData.address && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{formData.address}</p>}
                                            {formData.phone && <p className="text-xs text-slate-500 font-semibold mt-0.5">{formData.phone}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Color Swatch */}


                                {/* Contact info preview */}
                                {(formData.email || formData.phone) && (
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Details</p>
                                        <div className="space-y-2">
                                            {formData.email && (
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <Mail size={13} className="text-slate-400" />
                                                    <span className="font-medium">{formData.email}</span>
                                                </div>
                                            )}
                                            {formData.phone && (
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <Phone size={13} className="text-slate-400" />
                                                    <span className="font-medium">{formData.phone}</span>
                                                </div>
                                            )}
                                            {formData.address && (
                                                <div className="flex items-start gap-2 text-xs text-slate-600">
                                                    <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                                    <span className="font-medium line-clamp-2">{formData.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info Card */}
                        <div className="mt-4 rounded-2xl p-4 border border-indigo-100 bg-indigo-50/60 flex gap-3 items-start">
                            <Globe size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                Your branding will be applied across <span className="font-bold text-indigo-700">patient portals</span>, appointment reminders, and all client-facing communications.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between" >
                <p className="text-sm text-slate-400 font-medium">
                    {showSuccess ? '✓ All changes have been saved.' : 'Unsaved changes will not take effect until saved.'}
                </p>
                <div className="flex items-center gap-4">
                    <AnimatePresence>
                        {showSuccess && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl shadow-md flex items-center gap-2 font-black text-sm"
                            >
                                <CheckCircle2 size={16} />
                                Saved!
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || loading}
                        className={`group relative px-8 py-3.5 text-white rounded-xl font-black text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2.5 overflow-hidden ${isSaving || loading
                            ? 'bg-slate-400 cursor-not-allowed shadow-none'
                            : 'hover:-translate-y-0.5 shadow-indigo-200'
                            }`}
                        style={{ backgroundColor: isSaving || loading ? undefined : formData.brandColor }}
                    >
                        {(isSaving || loading) ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} className="transition-transform group-hover:scale-110" />
                        )}
                        <span>{(isSaving || loading) ? 'Saving...' : 'Save Changes'}</span>

                        {(isSaving || loading) && (
                            <motion.div
                                className="absolute bottom-0 left-0 h-0.5 bg-white/40"
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 1.5 }}
                            />
                        )}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
