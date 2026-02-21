import { useState, useEffect } from 'react';
import { useConfig } from '../contexts/ConfigContext';
import { Settings, Users, ShieldCheck, Plus, Trash2, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SettingsPage = () => {
    const { config, updateConfig, loading: configLoading } = useConfig();
    const [emails, setEmails] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const data = config['admin_emails'];
        if (data) {
            setEmails(Array.isArray(data) ? data : []);
        }
    }, [config]);

    const saveEmails = async () => {
        setSaving(true);
        setStatus(null);
        const { success, error } = await updateConfig('admin_emails', emails);
        if (success) {
            setStatus({ type: 'success', message: 'Admin whitelist updated!' });
            setTimeout(() => setStatus(null), 3000);
        } else {
            setStatus({ type: 'error', message: error });
        }
        setSaving(false);
    };

    const addEmail = () => {
        if (!newEmail || !newEmail.includes('@')) return;
        const normalized = newEmail.trim().toLowerCase();
        if (emails.includes(normalized)) return;
        setEmails([...emails, normalized]);
        setNewEmail('');
    };

    const removeEmail = (email) => {
        setEmails(emails.filter(e => e !== email));
    };

    if (configLoading && !config['admin_emails']) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Settings className="text-primary" /> Settings
                    </h1>
                    <p className="text-muted mt-1">Manage global app configurations and permissions</p>
                </div>

                <button
                    onClick={saveEmails}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Settings
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="glass p-8 rounded-[2rem] space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Users className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold">Admin Whitelist</h2>
                    </div>

                    <p className="text-sm text-muted">
                        Only users with these email addresses will be able to log into this admin panel.
                    </p>

                    <div className="flex gap-2">
                        <input
                            type="email"
                            placeholder="Enter admin email..."
                            className="input-field"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                        />
                        <button
                            onClick={addEmail}
                            className="px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {emails.map((email) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={email}
                                className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"
                            >
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-4 h-4 text-green-400" />
                                    <span className="text-sm font-medium">{email}</span>
                                </div>
                                <button
                                    onClick={() => removeEmail(email)}
                                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ))}
                        {emails.length === 0 && (
                            <div className="text-center py-8 text-muted italic text-sm">
                                No admins whitelisted yet.
                            </div>
                        )}
                    </div>
                </section>

                <section className="glass p-8 rounded-[2rem] space-y-6 opacity-50 pointer-events-none italic">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold">More Coming Soon</h2>
                    </div>
                    <p className="text-sm text-muted">
                        Future updates will include global app toggles, mass bunk probability overrides, and analytics configurations.
                    </p>
                </section>
            </div>

            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`fixed bottom-8 right-8 flex items-center gap-3 p-4 rounded-2xl border shadow-2xl z-50 ${status.type === 'success'
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}
                    >
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-medium text-sm">{status.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsPage;
