import { useState, useEffect } from 'react';
import { useConfig } from '../contexts/ConfigContext';
import { Wrench, Plus, Trash2, Save, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AppConfigPage = () => {
    const { config, loading: configLoading, updateConfig, refreshConfig } = useConfig();
    const [entries, setEntries] = useState([]);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [savingKey, setSavingKey] = useState(null);
    const [status, setStatus] = useState(null);
    const [expandedKey, setExpandedKey] = useState(null);
    const [editValues, setEditValues] = useState({});

    useEffect(() => {
        if (!configLoading && config) {
            const arr = Object.entries(config).map(([key, value]) => ({ key, value }));
            setEntries(arr);
            // Init edit values
            const edits = {};
            arr.forEach(e => { edits[e.key] = JSON.stringify(e.value, null, 2); });
            setEditValues(edits);
        }
    }, [config, configLoading]);

    const saveEntry = async (key) => {
        setSavingKey(key);
        try {
            const parsed = JSON.parse(editValues[key]);
            const { success, error } = await updateConfig(key, parsed);
            if (success) {
                setStatus({ type: 'success', message: `"${key}" saved!` });
            } else {
                setStatus({ type: 'error', message: error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: `Invalid JSON for "${key}": ${err.message}` });
        }
        setSavingKey(null);
        setTimeout(() => setStatus(null), 3000);
    };

    const addEntry = async () => {
        if (!newKey.trim()) return;
        let parsed;
        try {
            parsed = newValue.trim() ? JSON.parse(newValue) : '';
        } catch {
            setStatus({ type: 'error', message: 'Invalid JSON value' });
            setTimeout(() => setStatus(null), 3000);
            return;
        }
        setSavingKey('__new__');
        const { success, error } = await updateConfig(newKey.trim(), parsed);
        if (success) {
            setNewKey('');
            setNewValue('');
            setStatus({ type: 'success', message: `"${newKey.trim()}" created!` });
            await refreshConfig();
        } else {
            setStatus({ type: 'error', message: error });
        }
        setSavingKey(null);
        setTimeout(() => setStatus(null), 3000);
    };

    const deleteEntry = async (key) => {
        if (!confirm(`Delete config key "${key}"? This cannot be undone.`)) return;
        setSavingKey(key);
        try {
            const { error } = await (await import('../lib/supabase')).supabase
                .from('app_config')
                .delete()
                .eq('key', key);
            if (error) throw error;
            setEntries(prev => prev.filter(e => e.key !== key));
            setStatus({ type: 'success', message: `"${key}" deleted.` });
            await refreshConfig();
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
        setSavingKey(null);
        setTimeout(() => setStatus(null), 3000);
    };

    if (configLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Wrench className="text-primary" /> App Config
                </h1>
                <p className="text-muted mt-1">View and edit all app_config entries in Supabase</p>
            </div>

            {/* Existing Entries */}
            <div className="space-y-3">
                {entries.map((entry, i) => {
                    const isExpanded = expandedKey === entry.key;
                    const valuePreview = typeof entry.value === 'object'
                        ? JSON.stringify(entry.value).slice(0, 80) + '...'
                        : String(entry.value);

                    return (
                        <motion.div
                            key={entry.key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="glass rounded-2xl overflow-hidden"
                        >
                            <div
                                className="p-5 flex items-center justify-between gap-4 cursor-pointer"
                                onClick={() => setExpandedKey(isExpanded ? null : entry.key)}
                            >
                                <div className="overflow-hidden">
                                    <h3 className="font-bold font-mono text-sm text-primary">{entry.key}</h3>
                                    {!isExpanded && (
                                        <p className="text-xs text-muted truncate mt-1">{valuePreview}</p>
                                    )}
                                </div>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-3">
                                            <textarea
                                                value={editValues[entry.key] || ''}
                                                onChange={(e) => setEditValues(prev => ({ ...prev, [entry.key]: e.target.value }))}
                                                className="w-full p-4 bg-black/30 border border-white/10 rounded-xl text-sm font-mono text-green-300 min-h-[120px] resize-y focus:outline-none focus:border-primary/50"
                                                spellCheck={false}
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => deleteEntry(entry.key)}
                                                    disabled={savingKey === entry.key}
                                                    className="px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => saveEntry(entry.key)}
                                                    disabled={savingKey === entry.key}
                                                    className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                                                >
                                                    {savingKey === entry.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {/* Add New */}
            <div className="glass p-6 rounded-[2rem] space-y-4">
                <h2 className="font-bold flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Add New Config</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Config key (e.g. maintenance_mode)"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="input-field font-mono"
                    />
                    <textarea
                        placeholder='Value (JSON, e.g. true or {"enabled": false})'
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="input-field font-mono min-h-[48px] resize-y"
                        rows={1}
                    />
                </div>
                <button
                    onClick={addEntry}
                    disabled={savingKey === '__new__'}
                    className="btn-primary flex items-center gap-2"
                >
                    {savingKey === '__new__' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Add Config
                </button>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`fixed bottom-8 right-8 flex items-center gap-3 p-4 rounded-2xl border shadow-2xl z-50 ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                    >
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-medium text-sm">{status.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AppConfigPage;
