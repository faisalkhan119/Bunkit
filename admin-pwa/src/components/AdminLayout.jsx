import { useState } from 'react';
import Sidebar from './Sidebar';
import AdManager from '../pages/AdManager';
import DashboardHome from '../pages/DashboardHome';
import SettingsPage from '../pages/SettingsPage';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminLayout = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardHome />;
            case 'ads': return <AdManager />;
            case 'settings': return <SettingsPage />;
            default: return <DashboardHome />;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#05050a] text-white">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass z-40 flex items-center justify-between px-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                    Bunkit Admin
                </h1>
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 bg-white/5 rounded-xl border border-white/10"
                >
                    {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Sidebar - Desktop */}
            <div className="hidden lg:flex h-screen sticky top-0 py-4 pl-4">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Sidebar - Mobile Drawer */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="lg:hidden fixed inset-y-0 left-0 w-72 z-50 p-4"
                        >
                            <Sidebar
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                onClose={() => setIsSidebarOpen(false)}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 p-6 lg:p-8 pt-24 lg:pt-8 overflow-x-hidden">
                <div className="max-w-6xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
