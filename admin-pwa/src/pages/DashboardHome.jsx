import { Users, Megaphone, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardHome = () => {
    const stats = [
        { label: 'Active Users', value: '...', icon: Users, color: 'text-blue-400' },
        { label: 'Total Ads Live', value: '2', icon: Megaphone, color: 'text-purple-400' },
        { label: 'Avg Click Rate', value: '...', icon: Zap, color: 'text-yellow-400' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">Welcome back, Admin</h1>
                <p className="text-muted mt-1">Here&apos;s an overview of your Bunkit ecosystem</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass p-6 rounded-3xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted uppercase tracking-wider">{stat.label}</p>
                                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="glass p-8 rounded-[2rem] relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                            <h3 className="font-bold mb-2 group-hover:text-primary transition-colors">Update Daily Ad</h3>
                            <p className="text-sm text-muted">Change the banner and message shown to users daily.</p>
                        </div>
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                            <h3 className="font-bold mb-2 group-hover:text-primary transition-colors">Manage Whitelist</h3>
                            <p className="text-sm text-muted">Add or remove authorized admin email addresses.</p>
                        </div>
                    </div>
                </div>

                {/* Decorative background element */}
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/10 blur-[80px] rounded-full" />
            </div>
        </div>
    );
};

export default DashboardHome;
