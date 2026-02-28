import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, User, Mail, Calendar, Shield, Crown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const UserLookupPage = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [memberships, setMemberships] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setSearched(true);
        setSelectedUser(null);
        try {
            const searchTerm = `%${query.trim()}%`;
            let users = [];
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`email.ilike.${searchTerm},full_name.ilike.${searchTerm}`)
                .limit(20);

            if (error) {
                if (error.code === '42703' || error.message?.includes('does not exist') || error.code === 'PGRST204') {
                    console.log("Missing email column, falling back to name search only.");
                    const { data: fbData, error: fbError } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .ilike('full_name', searchTerm)
                        .limit(20);
                    if (fbError) throw fbError;
                    users = fbData || [];
                } else {
                    throw error;
                }
            } else {
                users = data || [];
            }

            setResults(users);
        } catch (err) {
            console.error('Search error:', err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const selectUser = async (user) => {
        setSelectedUser(user);
        setLoadingDetail(true);
        try {
            // Fetch class memberships
            const { data: memberData } = await supabase
                .from('class_memberships')
                .select('shared_class_id')
                .eq('user_id', user.id);

            if (memberData && memberData.length > 0) {
                const classIds = memberData.map(m => m.shared_class_id);
                const { data: classesData } = await supabase
                    .from('shared_classes')
                    .select('id, class_data')
                    .in('id', classIds);
                setMemberships(classesData || []);
            } else {
                setMemberships([]);
            }
        } catch (err) {
            console.error('Detail fetch error:', err);
            setMemberships([]);
        } finally {
            setLoadingDetail(false);
        }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Search className="text-primary" /> User Lookup
                </h1>
                <p className="text-muted mt-1">Search users by email or name for support</p>
            </div>

            {/* Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by email or name..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="input-field pl-12"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="btn-primary px-6 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Search
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Results List */}
                <div className="space-y-3">
                    {searched && results.length === 0 && !loading && (
                        <div className="glass p-8 rounded-3xl text-center text-muted">
                            No users found matching "{query}"
                        </div>
                    )}
                    {results.map((user, i) => (
                        <motion.div
                            key={user.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => selectUser(user)}
                            className={`glass p-5 rounded-2xl cursor-pointer transition-all hover:border-primary/30 ${selectedUser?.id === user.id ? 'border-primary/50 bg-primary/5' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <User className="text-primary w-6 h-6" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-bold truncate">{user.full_name || 'Unnamed User'}</p>
                                    <p className="text-sm text-muted truncate">{user.email || 'Guest'}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* User Detail Panel */}
                {selectedUser && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-8 rounded-[2rem] space-y-6 h-fit sticky top-8"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary-dark/30 flex items-center justify-center">
                                <User className="text-primary w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{selectedUser.full_name || 'Unnamed'}</h2>
                                <p className="text-muted text-sm">{selectedUser.email || 'No email (Guest)'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-xs text-muted uppercase tracking-wider mb-1">Joined</p>
                                <p className="font-medium text-sm flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted" /> {formatDate(selectedUser.created_at)}
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-xs text-muted uppercase tracking-wider mb-1">Last Seen</p>
                                <p className="font-medium text-sm flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted" /> {formatDate(selectedUser.last_seen)}
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-xs text-muted uppercase tracking-wider mb-1">Auth Provider</p>
                                <p className="font-medium text-sm flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-muted" /> {selectedUser.auth_provider || 'Guest'}
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-xs text-muted uppercase tracking-wider mb-1">User ID</p>
                                <p className="font-medium text-[10px] font-mono text-muted break-all">{selectedUser.id}</p>
                            </div>
                        </div>

                        {/* Class Memberships */}
                        <div>
                            <h3 className="font-bold flex items-center gap-2 mb-3">
                                <Crown className="w-4 h-4 text-yellow-400" /> Class Memberships
                            </h3>
                            {loadingDetail ? (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            ) : memberships.length === 0 ? (
                                <p className="text-sm text-muted italic">No class memberships found</p>
                            ) : (
                                <div className="space-y-2">
                                    {memberships.map(cls => (
                                        <div key={cls.id} className="p-3 bg-white/5 rounded-xl text-sm flex justify-between">
                                            <span className="font-medium">{cls.class_data?.name || cls.id}</span>
                                            <span className="text-xs text-muted font-mono">{cls.id.slice(0, 8)}...</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default UserLookupPage;
