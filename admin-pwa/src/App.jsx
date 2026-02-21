import { useAuth, AuthProvider } from './contexts/AuthContext';
import LoginGate from './components/LoginGate';
import AdminLayout from './components/AdminLayout';
import { Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { ConfigProvider } from './contexts/ConfigContext';

const AppContent = () => {
  const { user, isAdmin, loading, logout } = useAuth();

  // Show loader if still initializing OR if user is found but admin check is pending
  if (loading || (user && isAdmin === null)) {
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

  // Bug fix #6: Gate on isAdmin — only show if explicitly false (not null)
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-[#05050a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-md px-8"
        >
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p className="text-muted text-sm">
              Your account (<span className="text-white font-mono text-xs">{user.email}</span>) is not on the admin whitelist.
            </p>
            <p className="text-muted text-sm mt-2">If you just reopened the app and got this error, your network might still be connecting.</p>
          </div>
          <div className="flex gap-4 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-all text-sm font-medium"
            >
              Retry Connection
            </button>
            <button
              onClick={logout}
              className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
            >
              Logout
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
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </AuthProvider>
  );
}

export default App;
