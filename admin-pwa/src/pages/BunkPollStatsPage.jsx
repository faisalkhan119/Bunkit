import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart2, ThumbsUp, ThumbsDown, TrendingUp, RefreshCw, Loader2, Calendar, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ icon: Icon, label, value, color, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08 }}
        className="glass p-6 rounded-3xl"
    >
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl bg-white/5 ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
        </div>
    </motion.div>
);

const BunkPollStatsPage = () => {
    const [polls, setPolls] = useState([]);
    const [votes, setVotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch polls
            const { data: pollData, error: pollErr } = await supabase
                .from('mass_bunk_polls')
                .select('*')
                .order('created_at', { ascending: false });

            if (pollErr) {
                if (pollErr.code === '42P01') {
                    setError('The mass_bunk_polls table does not exist yet. Polls will appear here once users start creating them.');
                    setPolls([]);
                    setVotes([]);
                    setLoading(false);
                    return;
                }
                throw pollErr;
            }
            setPolls(pollData || []);

            // Fetch votes
            const { data: voteData, error: voteErr } = await supabase
                .from('mass_bunk_votes')
                .select('*');

            if (voteErr && voteErr.code !== '42P01') {
                console.warn('Votes fetch failed:', voteErr);
            }
            setVotes(voteData || []);

        } catch (err) {
            console.error('Poll stats error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <BarChart2 className="text-primary" /> Mass Bunk Polls
                    </h1>
                </div>
                <div className="glass p-8 rounded-3xl text-center">
                    <p className="text-muted">{error}</p>
                    <button onClick={fetchData} className="btn-primary mt-4">Retry</button>
                </div>
            </div>
        );
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const totalPolls = polls.length;
    const pollsToday = polls.filter(p => p.created_at?.startsWith(todayStr)).length;
    const totalVotes = votes.length;
    const yesVotes = votes.filter(v => v.vote === true || v.vote === 'yes').length;
    const noVotes = totalVotes - yesVotes;

    // Most active class
    const classCounts = {};
    polls.forEach(p => {
        const cid = p.shared_class_id || 'unknown';
        classCounts[cid] = (classCounts[cid] || 0) + 1;
    });
    const topClassId = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0];

    const statCards = [
        { label: 'Total Polls', value: totalPolls, icon: BarChart2, color: 'text-blue-400' },
        { label: 'Polls Today', value: pollsToday, icon: Calendar, color: 'text-purple-400' },
        { label: 'Total Votes', value: totalVotes, icon: Users, color: 'text-cyan-400' },
        { label: 'Yes Votes', value: yesVotes, icon: ThumbsUp, color: 'text-green-400' },
        { label: 'No Votes', value: noVotes, icon: ThumbsDown, color: 'text-red-400' },
        { label: 'Most Active Class', value: topClassId ? `${topClassId[0].slice(0, 8)}... (${topClassId[1]})` : '—', icon: TrendingUp, color: 'text-yellow-400' },
    ];

    // Vote counts per poll
    const votesByPoll = {};
    votes.forEach(v => {
        const pid = v.poll_id;
        if (!votesByPoll[pid]) votesByPoll[pid] = { yes: 0, no: 0 };
        if (v.vote === true || v.vote === 'yes') votesByPoll[pid].yes++;
        else votesByPoll[pid].no++;
    });

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <BarChart2 className="text-primary" /> Mass Bunk Polls
                    </h1>
                    <p className="text-muted mt-1">Trending polls and vote analytics</p>
                </div>
                <button onClick={fetchData} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((stat, i) => (
                    <StatCard key={stat.label} {...stat} index={i} />
                ))}
            </div>

            {/* Recent Polls Table */}
            <div className="glass p-6 rounded-[2rem]">
                <h2 className="text-xl font-bold mb-4">Recent Polls</h2>
                {polls.length === 0 ? (
                    <p className="text-center text-muted py-8">No polls yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider">Subject</th>
                                    <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider">Class</th>
                                    <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider">Target Date</th>
                                    <th className="text-center py-3 px-4 text-xs text-muted uppercase tracking-wider">Yes</th>
                                    <th className="text-center py-3 px-4 text-xs text-muted uppercase tracking-wider">No</th>
                                    <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {polls.slice(0, 50).map((poll, i) => {
                                    const pv = votesByPoll[poll.id] || { yes: 0, no: 0 };
                                    const isExpired = poll.target_date && poll.target_date < todayStr;
                                    return (
                                        <motion.tr
                                            key={poll.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: i * 0.02 }}
                                            className={`border-b border-white/5 ${isExpired ? 'opacity-50' : ''}`}
                                        >
                                            <td className="py-3 px-4 font-medium">{poll.subject_name || '—'}</td>
                                            <td className="py-3 px-4 font-mono text-xs text-muted">{(poll.shared_class_id || '').slice(0, 8)}...</td>
                                            <td className="py-3 px-4">{poll.target_date || '—'}</td>
                                            <td className="py-3 px-4 text-center text-green-400 font-bold">{pv.yes}</td>
                                            <td className="py-3 px-4 text-center text-red-400 font-bold">{pv.no}</td>
                                            <td className="py-3 px-4 text-muted text-xs">{new Date(poll.created_at).toLocaleDateString()}</td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BunkPollStatsPage;
