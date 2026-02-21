import { useAuth, AuthProvider } from './contexts/AuthContext';
import LoginGate from './components/LoginGate';
import AdminLayout from './components/AdminLayout';
import { Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const AppContent = () => {
  const { user, isAdmin, loading, logout, hardReset } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin" />
          </div>
          <p className="text-muted font-medium animate-pulse">Initializing Portal...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginGate />;
  }

  return <AdminLayout />;
};

import { ConfigProvider } from './contexts/ConfigContext';

function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </AuthProvider>
  );
}

export default App;
