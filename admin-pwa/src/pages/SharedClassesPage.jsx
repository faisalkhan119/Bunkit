import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Search, Trash2, Copy, ChevronDown, ChevronUp, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SharedClassesPage = () => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [copied, setCopied] = useState(null);

    const fetchClasses = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shared_classes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClasses(data || []);
        } catch (err) {
            console.error('Fetch shared classes error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchClasses(); }, [fetchClasses]);

    const handleDelete = async (id) => {
        if (!confirm(`Delete shared class "${id}"? This will break any existing share links.`)) return;
        setDeleting(id);
        try {
            const { error } = await supabase.from('shared_classes').delete().eq('id', id);
            if (error) throw error;
            setClasses(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            alert('Delete failed: ' + err.message);
        } finally {
            setDeleting(null);
        }
    };

    const copyLink = (id) => {
        const textToCopy = `BunkIt Request\nInstall Class Using Below Link:\nhttps://bunkitapp.in/?shared_class_id=${id}`;
        navigator.clipboard.writeText(textToCopy);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const filtered = classes.filter(c => {
        const name = c.class_data?.name || '';
        return name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <BookOpen className="text-primary" /> Shared Classes
                    </h1>
                    <p className="text-muted mt-1">{classes.length} classes shared via links/QR codes</p>
                </div>
                <button onClick={fetchClasses} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                    type="text"
                    placeholder="Search by class name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field pl-12"
                />
            </div>

            {/* Class List */}
            <div className="space-y-3">
                {filtered.length === 0 && (
                    <div className="glass p-12 rounded-3xl text-center text-muted">
                        {search ? 'No classes match your search.' : 'No shared classes yet.'}
                    </div>
                )}
                {filtered.map((cls, i) => {
                    const data = cls.class_data || {};
                    const isExpanded = expandedId === cls.id;
                    const subjectCount = data.subjects?.length || 0;
                    const holidayCount = data.holidays?.length || 0;

                    return (
                        <motion.div
                            key={cls.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="glass rounded-2xl overflow-hidden"
                        >
                            <div className="p-5 flex items-center justify-between gap-4">
                                <div
                                    className="flex-1 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : cls.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg">{data.name || 'Unnamed'}</h3>
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                                    </div>
                                    <div className="flex gap-4 mt-1 text-xs text-muted">
                                        <span>{subjectCount} subjects</span>
                                        <span>{holidayCount} holidays</span>
                                        <span>{new Date(cls.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyLink(cls.id)}
                                        className={`p-2 rounded-lg transition-all ${copied === cls.id ? 'bg-green-500/20 text-green-400' : 'bg-white/5 hover:bg-white/10 text-muted'}`}
                                        title="Copy share link"
                                    >
                                        {copied === cls.id ? '✓' : <Copy className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cls.id)}
                                        disabled={deleting === cls.id}
                                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                        title="Delete"
                                    >
                                        {deleting === cls.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
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
                                            <div className="flex gap-2 items-center text-xs text-muted font-mono">
                                                <span>ID: {cls.id}</span>
                                                <a href={`https://www.bunkitapp.in/?shared_class_id=${cls.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    Open Link <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>

                                            {data.lastDate && <p className="text-sm text-muted">Last Date: <span className="text-white">{data.lastDate}</span></p>}
                                            {data.startDate && <p className="text-sm text-muted">Start Date: <span className="text-white">{data.startDate}</span></p>}

                                            {data.subjects && data.subjects.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Subjects</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {data.subjects.map((s, j) => (
                                                            <div key={j} className="p-3 bg-white/5 rounded-xl text-sm">
                                                                <span className="font-medium">{s.name}</span>
                                                                {s.code && <span className="text-muted ml-2">({s.code})</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default SharedClassesPage;
