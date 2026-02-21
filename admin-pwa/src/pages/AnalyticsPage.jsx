import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart2, Eye, MousePointerClick, SkipForward, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const AD_TYPES = [
    { key: 'daily_ad', label: 'Daily Ad', color: 'from-purple-500/20 to-purple-900/5', accent: 'text-purple-400', border: 'border-purple-500/20' },
    { key: 'calculate_ad', label: 'Calculate Ad', color: 'from-blue-500/20 to-blue-900/5', accent: 'text-blue-400', border: 'border-blue-500/20' },
];

// Aggregate raw events into stats per adType
function aggregateEvents(events) {
    const stats = {};
    AD_TYPES.forEach(({ key }) => {
        stats[key] = { views: 0, skips: 0, clicks: {}, totalClicks: 0 };
    });

    events.forEach(ev => {
        const s = stats[ev.ad_type];
        if (!s) return;
        if (ev.event_type === 'view') s.views++;
        if (ev.event_type === 'skip') s.skips++;
        if (ev.event_type === 'click') {
            const label = ev.button_label || 'Unknown Button';
            s.clicks[label] = (s.clicks[label] || 0) + 1;
            s.totalClicks++;
        }
    });

    return stats;
}

const StatCard = ({ icon: Icon, label, value, accent }) => (
    <div className="flex items-center gap-4 p-4 bg-white/3 rounded-2xl border border-white/5">
        <div className={`p-2.5 rounded-xl bg-white/5 ${accent}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-xs text-muted uppercase tracking-wider font-bold">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
        </div>
    </div>
);

const AdStatsCard = ({ adMeta, stats, index }) => {
    const skipRate = stats.views > 0 ? ((stats.skips / stats.views) * 100).toFixed(1) : '—';
    const clickRate = stats.views > 0 ? ((stats.totalClicks / stats.views) * 100).toFixed(1) : '—';
    const clickLabels = Object.entries(stats.clicks);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12 }}
            className={`glass p-6 rounded-[2rem] bg-gradient-to-br ${adMeta.color} border ${adMeta.border} space-y-5`}
        >
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-white/5 ${adMeta.accent}`}>
                    <BarChart2 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">{adMeta.label}</h2>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Eye} label="Total Views" value={stats.views.toLocaleString()} accent={adMeta.accent} />
                <StatCard icon={SkipForward} label="Total Skips" value={stats.skips.toLocaleString()} accent={adMeta.accent} />
                <StatCard icon={TrendingUp} label="Skip Rate" value={stats.views > 0 ? `${skipRate}%` : '—'} accent={adMeta.accent} />
                <StatCard icon={MousePointerClick} label="Click Rate" value={stats.views > 0 ? `${clickRate}%` : '—'} accent={adMeta.accent} />
            </div>

            {/* CTA Breakdown */}
            <div>
                <p className="text-xs text-muted uppercase tracking-wider font-bold mb-3">CTA Button Clicks</p>
                {clickLabels.length === 0 ? (
                    <p className="text-sm text-muted italic">No CTA clicks recorded yet</p>
                ) : (
                    <div className="space-y-2">
                        {clickLabels.map(([label, count]) => (
                            <div key={label} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <MousePointerClick className={`w-4 h-4 flex-shrink-0 ${adMeta.accent}`} />
                                    <span className="text-sm font-medium truncate">{label}</span>
                                </div>
                                <span className={`text-sm font-bold ml-3 ${adMeta.accent}`}>{count}×</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const AnalyticsPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [range, setRange] = useState('7d'); // '1d' | '7d' | '30d' | 'all'
    const [lastRefreshed, setLastRefreshed] = useState(null);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from('ad_events').select('ad_type, event_type, button_label, button_url, created_at');

            if (range !== 'all') {
                const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
                const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
                query = query.gte('created_at', since);
            }

            const { data, error: sb } = await query.order('created_at', { ascending: false });
            if (sb) throw new Error(sb.message);
            setEvents(data || []);
            setLastRefreshed(new Date());
        } catch (err) {
            console.error('Analytics fetch failed:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const stats = aggregateEvents(events);
    const totalEvents = events.length;

    const RANGE_OPTS = [
        { value: '1d', label: 'Today' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: 'all', label: 'All Time' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <BarChart2 className="text-primary" /> Analytics
                    </h1>
                    <p className="text-muted mt-1">
                        Real-time ad performance data
                        {lastRefreshed && <span className="ml-2 text-xs opacity-60">· updated {lastRefreshed.toLocaleTimeString()}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Date range */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
                        {RANGE_OPTS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setRange(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === opt.value
                                    ? 'bg-primary/20 text-primary shadow'
                                    : 'text-muted hover:text-white'
                                    }`}
                            >{opt.label}</button>
                        ))}
                    </div>
                    <button
                        onClick={fetchEvents}
                        disabled={loading}
                        className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Summary bar */}
            <div className="glass p-4 rounded-2xl flex items-center gap-6 flex-wrap border border-white/5">
                <div className="text-center">
                    <p className="text-xs text-muted uppercase tracking-wider font-bold">Total Events</p>
                    <p className="text-2xl font-bold">{totalEvents.toLocaleString()}</p>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                {AD_TYPES.map(ad => (
                    <div key={ad.key} className="text-center">
                        <p className={`text-xs uppercase tracking-wider font-bold ${ad.accent}`}>{ad.label} Views</p>
                        <p className="text-2xl font-bold">{stats[ad.key].views.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
                    ⚠️ Failed to load analytics: {error}
                </div>
            )}

            {/* Per-ad stats cards */}
            {loading && events.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {AD_TYPES.map((ad, i) => (
                        <AdStatsCard key={ad.key} adMeta={ad} stats={stats[ad.key]} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnalyticsPage;
