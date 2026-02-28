import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, UserCheck, Activity, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
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

const UserAnalyticsPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all profiles
            let allUsers = [];
            let isFallback = false;
            const { data: profiles, error: profilesErr } = await supabase
                .from('profiles')
                .select('id, full_name, email, created_at, last_seen, auth_provider, is_guest');

            if (profilesErr) {
                if (profilesErr.code === '42703' || profilesErr.message?.includes('does not exist') || profilesErr.code === 'PGRST204') {
                    console.log("Missing columns in profiles table! Falling back to basic fetch.");
                    isFallback = true;
                    // Basic fallback fetch (only id and full_name are guaranteed)
                    const { data: fallbackProfiles, error: fallbackErr } = await supabase
                        .from('profiles')
                        .select('id, full_name');
                    if (fallbackErr) throw fallbackErr;
                    allUsers = fallbackProfiles || [];
                } else {
                    throw profilesErr;
                }
            } else {
                allUsers = profiles || [];
            }
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
            const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

            const totalUsers = allUsers.length;
            const registeredUsers = isFallback ? 'N/A' : allUsers.filter(u => u.email || (u.auth_provider && u.auth_provider !== 'guest')).length;
            const guestUsers = isFallback ? 'N/A' : totalUsers - registeredUsers;
            const newToday = isFallback ? 'N/A' : allUsers.filter(u => u.created_at >= todayStart).length;
            const activeThisWeek = isFallback ? 'N/A' : allUsers.filter(u => u.last_seen && u.last_seen >= weekAgo).length;
            const newThisMonth = isFallback ? 'N/A' : allUsers.filter(u => u.created_at >= monthAgo).length;

            // Signups by day (last 14 days)
            const signupsByDay = [];
            for (let i = 13; i >= 0; i--) {
                const day = new Date(now);
                day.setDate(day.getDate() - i);
                const dayStr = day.toISOString().slice(0, 10);
                const count = isFallback ? 0 : allUsers.filter(u => u.created_at && u.created_at.startsWith(dayStr)).length;
                signupsByDay.push({ date: dayStr.slice(5), count }); // MM-DD format
            }

            setStats({
                totalUsers,
                registeredUsers,
                guestUsers,
                newToday,
                activeThisWeek,
                newThisMonth,
                signupsByDay
            });
        } catch (err) {
            console.error('Analytics fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass p-8 rounded-3xl text-center">
                <p className="text-red-400 mb-4">Failed to load analytics: {error}</p>
                <button onClick={fetchStats} className="btn-primary">Retry</button>
            </div>
        );
    }

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
        { label: 'Registered', value: stats.registeredUsers, icon: UserCheck, color: 'text-green-400' },
        { label: 'Guest Users', value: stats.guestUsers, icon: Users, color: 'text-orange-400' },
        { label: 'New Today', value: stats.newToday, icon: UserPlus, color: 'text-purple-400' },
        { label: 'Active This Week', value: stats.activeThisWeek, icon: Activity, color: 'text-cyan-400' },
        { label: 'New This Month', value: stats.newThisMonth, icon: TrendingUp, color: 'text-yellow-400' },
    ];

    const maxSignup = Math.max(...stats.signupsByDay.map(d => d.count), 1);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <TrendingUp className="text-primary" /> User Analytics
                    </h1>
                    <p className="text-muted mt-1">Real-time user growth and engagement metrics</p>
                </div>
                <button onClick={fetchStats} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((stat, i) => (
                    <StatCard key={stat.label} {...stat} index={i} />
                ))}
            </div>

            {/* Signup Chart */}
            <div className="glass p-8 rounded-[2rem]">
                <h2 className="text-xl font-bold mb-6">Signups — Last 14 Days</h2>
                <div className="flex items-end gap-2 h-40">
                    {stats.signupsByDay.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-muted font-mono">{day.count || ''}</span>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max((day.count / maxSignup) * 100, 4)}%` }}
                                transition={{ delay: i * 0.03, duration: 0.4 }}
                                className="w-full bg-gradient-to-t from-primary/60 to-primary rounded-t-lg min-h-[4px]"
                            />
                            <span className="text-[9px] text-muted font-mono">{day.date}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserAnalyticsPage;
