import { useState, useEffect } from 'react';
import { useConfig } from '../contexts/ConfigContext';
import { UserPlus, Crown, Trash2, Calendar, ShieldCheck, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PLAN_DURATIONS = {
    '1_month': { label: '1 Month', days: 30, color: 'text-blue-400 bg-blue-400/10' },
    '6_months': { label: '6 Months', days: 180, color: 'text-purple-400 bg-purple-400/10' },
    '1_year': { label: '1 Year', days: 365, color: 'text-amber-400 bg-amber-400/10' },
    'lifetime': { label: 'Lifetime', days: 36500, color: 'text-emerald-400 bg-emerald-400/10' } // 100 years approx
};

const UsersPage = () => {
    const { config, updateConfig, loading: configLoading } = useConfig();
    const [subscribers, setSubscribers] = useState({});
    const [email, setEmail] = useState('');
    const [plan, setPlan] = useState('1_month');
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (!configLoading && config.premium_users) {
            setSubscribers(config.premium_users);
        }
    }, [config, configLoading]);

    const handleGrantPremium = async (e) => {
        e.preventDefault();
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return;

        setSaving(true);
        setStatus(null);

        const duration = PLAN_DURATIONS[plan].days;
        const expiresAt = Date.now() + (duration * 24 * 60 * 60 * 1000);

        const updatedSubscribers = {
            ...subscribers,
            [normalizedEmail]: {
                plan: plan,
                granted_at: Date.now(),
                expires_at: expiresAt
            }
        };

        const { success, error } = await updateConfig('premium_users', updatedSubscribers);

        if (success) {
            setSubscribers(updatedSubscribers);
            setEmail('');
            setStatus({ type: 'success', message: `${normalizedEmail} upgraded to ${PLAN_DURATIONS[plan].label} Premium!` });
            setTimeout(() => setStatus(null), 4000);
        } else {
            setStatus({ type: 'error', message: error || 'Failed to grant premium access.' });
        }
        setSaving(false);
    };

    const handleRevoke = async (userEmail) => {
        if (!confirm(`Are you sure you want to revoke premium access for ${userEmail}?`)) return;

        setSaving(true);
        const updatedSubscribers = { ...subscribers };
        delete updatedSubscribers[userEmail];

        const { success, error } = await updateConfig('premium_users', updatedSubscribers);

        if (success) {
            setSubscribers(updatedSubscribers);
        } else {
            alert('Failed to revoke access: ' + error);
        }
        setSaving(false);
    };

    const formatTimestamp = (ts) => {
        if (!ts) return 'Unknown';
        const date = new Date(ts);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const isExpired = (expiresAt) => {
        return Date.now() > expiresAt;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl">
                    <Crown size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">User Management</h1>
                    <p className="text-slate-400 mt-1">Grant or revoke premium ad-free access for users.</p>
                </div>
            </div>

            {/* Status Message */}
            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 rounded-xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}
                    >
                        {status.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                        <p className="font-medium">{status.message}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Add Premium Form */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-xl sticky top-6">
                        <div className="flex items-center gap-2 mb-6">
                            <UserPlus size={20} className="text-indigo-400" />
                            <h2 className="text-lg font-semibold text-slate-200">Grant Premium</h2>
                        </div>

                        <form onSubmit={handleGrantPremium} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">User Email</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Duration</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(PLAN_DURATIONS).map(([key, info]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setPlan(key)}
                                            className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${plan === key
                                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                                    : 'bg-slate-900/30 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                                                }`}
                                        >
                                            {info.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving || !email.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                {saving ? 'Granting...' : 'Upgrade User'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Subscriptions List */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Crown size={20} className="text-amber-400" />
                                <h2 className="text-lg font-semibold text-slate-200">Active Subscriptions</h2>
                            </div>
                            <span className="bg-slate-900/50 text-slate-400 py-1 px-3 rounded-full text-xs font-semibold border border-slate-700/50">
                                {Object.keys(subscribers).length} Total
                            </span>
                        </div>

                        {configLoading ? (
                            <div className="p-12 flex flex-col items-center justify-center text-slate-500">
                                <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
                                <p>Loading premium registry...</p>
                            </div>
                        ) : Object.keys(subscribers).length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                                    <ShieldCheck size={28} className="text-slate-500" />
                                </div>
                                <h3 className="text-slate-300 font-medium mb-1">No Premium Users</h3>
                                <p className="text-slate-500 text-sm max-w-sm">
                                    Use the form on the left to grant ad-free premium access to specific user emails.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700/50">
                                {Object.entries(subscribers).sort((a, b) => b[1].granted_at - a[1].granted_at).map(([userEmail, data]) => {
                                    const expired = isExpired(data.expires_at);
                                    const planInfo = PLAN_DURATIONS[data.plan] || { label: 'Legacy Plan', color: 'text-slate-400 bg-slate-400/10' };

                                    return (
                                        <div key={userEmail} className="p-5 hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-lg mt-0.5 ${expired ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                    <Mail size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-slate-200 font-medium">{userEmail}</h4>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planInfo.color}`}>
                                                            {planInfo.label}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Calendar size={13} />
                                                            {expired ? (
                                                                <span className="text-red-400">Expired: {formatTimestamp(data.expires_at)}</span>
                                                            ) : data.plan === 'lifetime' ? (
                                                                <span className="text-emerald-400">Never Expires</span>
                                                            ) : (
                                                                <span>Expires: {formatTimestamp(data.expires_at)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleRevoke(userEmail)}
                                                disabled={saving}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                title="Revoke Premium Access"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default UsersPage;
