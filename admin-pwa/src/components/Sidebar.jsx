import { LayoutDashboard, Megaphone, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

const Sidebar = ({ activeTab, setActiveTab, onClose }) => {
    const { user, logout } = useAuth();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'ads', label: 'Ad Manager', icon: Megaphone },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const handleTabClick = (id) => {
        setActiveTab(id);
        if (onClose) onClose();
    };

    return (
        <aside className="w-64 glass border-r-0 rounded-r-3xl h-full flex flex-col p-4">
            <div className="p-4 mb-8">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                    Bunkit Admin
                </h1>
            </div>

            <nav className="flex-1 space-y-2">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id
                                ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                                : 'text-muted hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                        {activeTab === item.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="ml-auto w-1 h-5 bg-primary rounded-full"
                            />
                        )}
                    </button>
                ))}
            </nav>

            <div className="mt-auto p-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="text-primary w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{user?.email}</p>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Administrator</p>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all font-medium"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
