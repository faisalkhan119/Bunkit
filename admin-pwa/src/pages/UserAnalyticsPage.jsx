import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, UserCheck, Activity, TrendingUp, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ icon: Icon, label, value, color, index, subtitle }) => (
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
                {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
        </div>
    </motion.div>
);

const UserAnalyticsPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [availableCols, setAvailableCols] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Step 1: Fetch ALL profiles with select('*') to get whatever columns exist
            const { data: profiles, error: profilesErr } = await supabase
                .from('profiles')
                .select('*');

            if (profilesErr) throw profilesErr;

            const allUsers = profiles || [];
            const totalUsers = allUsers.length;

            if (totalUsers === 0) {
                setStats({
                    totalUsers: 0,
                    registeredUsers: 0,
                    guestUsers: 0,
                    newToday: 0,
                    activeThisWeek: 0,
                    newThisMonth: 0,
                    signupsByDay: [],
                    colsAvailable: {}
                });
                setLoading(false);
                return;
            }

            // Step 2: Detect which columns actually exist from the first row
            const sampleRow = allUsers[0];
            const cols = {
                hasCreatedAt: 'created_at' in sampleRow,
                hasEmail: 'email' in sampleRow,
                hasLastSeen: 'last_seen' in sampleRow,
                hasAuthProvider: 'auth_provider' in sampleRow,
                hasIsGuest: 'is_guest' in sampleRow,
                hasFullName: 'full_name' in sampleRow,
                hasPhone: 'phone' in sampleRow,
            };
            setAvailableCols(cols);
            console.log('📊 Profile columns detected:', cols);

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
            const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

            // Calculate metrics based on available columns
            let registeredUsers, guestUsers, newToday, activeThisWeek, newThisMonth;

            // Registered vs Guest detection
            if (cols.hasIsGuest) {
                guestUsers = allUsers.filter(u => u.is_guest === true).length;
                registeredUsers = totalUsers - guestUsers;
            } else if (cols.hasEmail) {
                registeredUsers = allUsers.filter(u => u.email && !u.email.includes('guest_') && !u.email.includes('@bunkit.local')).length;
                guestUsers = totalUsers - registeredUsers;
            } else if (cols.hasAuthProvider) {
                guestUsers = allUsers.filter(u => u.auth_provider === 'guest' || !u.auth_provider).length;
                registeredUsers = totalUsers - guestUsers;
            } else {
                // Best guess: users with full_name set are likely registered
                registeredUsers = allUsers.filter(u => u.full_name && u.full_name.trim()).length;
                guestUsers = totalUsers - registeredUsers;
            }

            // Time-based metrics
            if (cols.hasCreatedAt) {
                newToday = allUsers.filter(u => u.created_at && u.created_at >= todayStart).length;
                newThisMonth = allUsers.filter(u => u.created_at && u.created_at >= monthAgo).length;
            } else {
                newToday = '—';
                newThisMonth = '—';
            }

            if (cols.hasLastSeen) {
                activeThisWeek = allUsers.filter(u => u.last_seen && u.last_seen >= weekAgo).length;
            } else {
                activeThisWeek = '—';
            }

            // Signups chart (last 14 days)
            const signupsByDay = [];
            if (cols.hasCreatedAt) {
                for (let i = 13; i >= 0; i--) {
                    const day = new Date(now);
                    day.setDate(day.getDate() - i);
                    const dayStr = day.toISOString().slice(0, 10);
                    const count = allUsers.filter(u => u.created_at && u.created_at.startsWith(dayStr)).length;
                    signupsByDay.push({ date: dayStr.slice(5), count });
                }
            }

            setStats({
                totalUsers,
                registeredUsers,
                guestUsers,
                newToday,
                activeThisWeek,
                newThisMonth,
                signupsByDay,
                colsAvailable: cols
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

    if (!stats) return null;

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
        { label: 'Registered', value: stats.registeredUsers, icon: UserCheck, color: 'text-green-400' },
        { label: 'Guest Users', value: stats.guestUsers, icon: Users, color: 'text-orange-400' },
        {
            label: 'New Today', value: stats.newToday, icon: UserPlus, color: 'text-purple-400',
            subtitle: stats.newToday === '—' ? 'No created_at column' : undefined
        },
        {
            label: 'Active This Week', value: stats.activeThisWeek, icon: Activity, color: 'text-cyan-400',
            subtitle: stats.activeThisWeek === '—' ? 'No last_seen column' : undefined
        },
        {
            label: 'New This Month', value: stats.newThisMonth, icon: TrendingUp, color: 'text-yellow-400',
            subtitle: stats.newThisMonth === '—' ? 'No created_at column' : undefined
        },
    ];

    const hasChart = stats.signupsByDay.length > 0;
    const maxSignup = hasChart ? Math.max(...stats.signupsByDay.map(d => d.count), 1) : 1;

    // Check for missing columns to show a helpful warning
    const missingCols = [];
    if (!stats.colsAvailable.hasCreatedAt) missingCols.push('created_at');
    if (!stats.colsAvailable.hasLastSeen) missingCols.push('last_seen');

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

            {missingCols.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm"
                >
                    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-bold">Some metrics are unavailable</p>
                        <p className="text-yellow-400/70 mt-1">
                            Missing columns in <code className="bg-white/5 px-1 rounded">profiles</code> table: <code className="bg-white/5 px-1 rounded">{missingCols.join(', ')}</code>.
                            Add these columns in Supabase Dashboard to enable time-based metrics.
                        </p>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((stat, i) => (
                    <StatCard key={stat.label} {...stat} index={i} />
                ))}
            </div>

            {/* Signup Chart */}
            {hasChart ? (
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
            ) : (
                <div className="glass p-8 rounded-[2rem] text-center text-muted">
                    <p>Signup chart requires <code className="bg-white/5 px-1 rounded">created_at</code> column in profiles table.</p>
                </div>
            )}
        </div>
    );
};

export default UserAnalyticsPage;
