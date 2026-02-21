import { useState } from 'react';
import Sidebar from './Sidebar';
import AdManager from '../pages/AdManager';
import DashboardHome from '../pages/DashboardHome';
import SettingsPage from '../pages/SettingsPage';

const AdminLayout = () => {
    const [activeTab, setActiveTab] = useState('dashboard');

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardHome />;
            case 'ads': return <AdManager />;
            case 'settings': return <SettingsPage />;
            default: return <DashboardHome />;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#05050a]">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
