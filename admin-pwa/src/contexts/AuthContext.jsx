import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
const VERSION = "2.0.0";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let mounted = true;

        // Safety timeout to prevent infinite loading state
        const timeoutId = setTimeout(() => {
            if (mounted && loading) {
                console.warn('⚠️ Auth initialization timed out');
                setLoading(false);
            }
        }, 8000);

        // Single path for initialization and auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            console.log('📡 Auth State Change:', event);
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                await checkAdmin(currentUser.email);
            } else {
                setIsAdmin(false);
            }

            setLoading(false);
            clearTimeout(timeoutId);
        });

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const checkAdmin = async (email, retries = 1) => {
        if (!email) return false;

        try {
            console.log(`🔐 Checking admin status for: ${email.trim().toLowerCase()}`);

            const { data, error } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'admin_emails')
                .single();

            if (error) {
                if (retries > 0 && (error.message?.includes('fetch') || error.code === 'PGRST116')) {
                    console.warn('🔄 Retrying admin check...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return checkAdmin(email, retries - 1);
                }
                throw error;
            }

            const adminEmails = Array.isArray(data?.value) ? data.value : [];
            const normalizedUserEmail = email.trim().toLowerCase();

            const isWhitelisted = adminEmails.some(e => {
                if (typeof e !== 'string') return false;
                return e.trim().toLowerCase() === normalizedUserEmail;
            });

            console.log(isWhitelisted ? '✅ Admin verified' : '❌ Not in whitelist');
            setIsAdmin(isWhitelisted);
            return isWhitelisted;
        } catch (err) {
            console.error('🚫 Error checking admin status:', err);
            setIsAdmin(false);
            return false;
        }
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const loginWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href }
        });
        if (error) throw error;
    };

    const logout = async () => {
        console.log('🚪 Logout Initiated [v' + VERSION + ']');
        try {
            await Promise.race([
                supabase.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
            ]);
        } catch (err) {
            console.warn('Signout timeout, proceeding with local purge:', err.message);
        } finally {
            localStorage.clear();
            sessionStorage.clear();

            // Unregister service workers to force fresh load
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
            }

            // Reload the current admin panel URL (not the root app)
            const baseUrl = window.location.href.split('?')[0];
            window.location.href = baseUrl + '?logout=' + Date.now();
        }
    };

    const hardReset = () => {
        console.warn('⚠️ Performing Manual Hard Reset...');
        localStorage.clear();
        sessionStorage.clear();
        const baseUrl = window.location.href.split('?')[0];
        window.location.href = baseUrl;
    };

    return (
        <AuthContext.Provider value={{ user, isAdmin, loading, authLoading: loading, login, loginWithGoogle, logout, hardReset, version: VERSION }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
