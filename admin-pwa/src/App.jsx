import { useAuth, AuthProvider } from './contexts/AuthContext';
import LoginGate from './components/LoginGate';
import AdminLayout from './components/AdminLayout';
import { Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const AppContent = () => {
  const { user, isAdmin, loading } = useAuth();

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

  if (!isAdmin) {
    const { logout } = useAuth();
    return (
      <div className="min-h-screen bg-[#05050a] flex items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-12 rounded-[2.5rem] max-w-lg"
        >
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted leading-relaxed mb-8">
            Your email (<span className="text-white font-medium">{user.email}</span>) is not on the authorized admin whitelist. Please contact the system owner if you believe this is a mistake.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Retry Check
            </button>
            <button
              onClick={logout}
              className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all"
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <AdminLayout />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
