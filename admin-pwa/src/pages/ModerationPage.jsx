import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Trash2, RefreshCw, Loader2, BookOpen, Vote } from 'lucide-react';
import { motion } from 'framer-motion';

const ModerationPage = () => {
    const [activeTab, setActiveTab] = useState('classes');
    const [classes, setClasses] = useState([]);
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);

    const fetchClasses = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shared_classes')
                .select('id, class_data, created_at')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            setClasses(data || []);
        } catch (err) {
            console.error('Moderation fetch classes error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPolls = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('mass_bunk_polls')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) {
                // Table might not exist
                if (error.code === '42P01') {
                    setPolls([]);
                    return;
                }
                throw error;
            }
            setPolls(data || []);
        } catch (err) {
            console.error('Moderation fetch polls error:', err);
            setPolls([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'classes') fetchClasses();
        else fetchPolls();
    }, [activeTab, fetchClasses, fetchPolls]);

    const deleteClass = async (id, name) => {
        if (!confirm(`Delete shared class "${name || id}"? This will break existing links.`)) return;
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

    const deletePoll = async (id) => {
        if (!confirm('Delete this poll?')) return;
        setDeleting(id);
        try {
            const { error } = await supabase.from('mass_bunk_polls').delete().eq('id', id);
            if (error) throw error;
            setPolls(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            alert('Delete failed: ' + err.message);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="text-primary" /> Content Moderation
                    </h1>
                    <p className="text-muted mt-1">Review and remove inappropriate content</p>
                </div>
                <button
                    onClick={() => activeTab === 'classes' ? fetchClasses() : fetchPolls()}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 glass rounded-2xl">
                <button
                    onClick={() => setActiveTab('classes')}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'classes' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'}`}
                >
                    <BookOpen className="w-4 h-4" /> Class Names ({classes.length})
                </button>
                <button
                    onClick={() => setActiveTab('polls')}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'polls' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'}`}
                >
                    <Vote className="w-4 h-4" /> Mass Bunk Polls ({polls.length})
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : activeTab === 'classes' ? (
                <div className="space-y-2">
                    {classes.length === 0 && (
                        <div className="glass p-12 rounded-3xl text-center text-muted">No shared classes found.</div>
                    )}
                    {classes.map((cls, i) => {
                        const name = cls.class_data?.name || 'Unnamed';
                        const subjectCount = cls.class_data?.subjects?.length || 0;
                        return (
                            <motion.div
                                key={cls.id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.02 }}
                                className="glass p-4 rounded-xl flex items-center justify-between"
                            >
                                <div>
                                    <p className="font-medium">{name}</p>
                                    <p className="text-xs text-muted">{subjectCount} subjects · {new Date(cls.created_at).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={() => deleteClass(cls.id, name)}
                                    disabled={deleting === cls.id}
                                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                >
                                    {deleting === cls.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-2">
                    {polls.length === 0 && (
                        <div className="glass p-12 rounded-3xl text-center text-muted">No mass bunk polls found (table may not exist yet).</div>
                    )}
                    {polls.map((poll, i) => (
                        <motion.div
                            key={poll.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="glass p-4 rounded-xl flex items-center justify-between"
                        >
                            <div>
                                <p className="font-medium">{poll.subject_name || poll.question || 'Untitled Poll'}</p>
                                <p className="text-xs text-muted">
                                    Class: {poll.shared_class_id?.slice(0, 8) || '?'} · Target: {poll.target_date || '?'} · {new Date(poll.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => deletePoll(poll.id)}
                                disabled={deleting === poll.id}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                            >
                                {deleting === poll.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModerationPage;
