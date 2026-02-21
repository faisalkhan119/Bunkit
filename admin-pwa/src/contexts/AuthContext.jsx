import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
const VERSION = "2.0.1";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(null);

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

    useEffect(() => {
        let mounted = true;

        const timeoutId = setTimeout(() => {
            if (mounted && loading) {
                console.warn('⚠️ Auth initialization timed out');
                setLoading(false);
                if (isAdmin === null) setIsAdmin(false);
            }
        }, 12000);

        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!mounted) return;

                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await checkAdmin(currentUser.email);
                } else {
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error('Portal: Initial session fetch failed:', err);
                if (mounted) setIsAdmin(false);
            } finally {
                if (mounted) {
                    setLoading(false);
                    clearTimeout(timeoutId);
                }
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            console.log('📡 Auth State Change:', event);

            try {
                const currentUser = session?.user ?? null;
                setUser(currentUser);
                if (currentUser) {
                    await checkAdmin(currentUser.email);
                } else {
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error('Portal: Auth event logic failed:', err);
                setIsAdmin(false);
            } finally {
                setLoading(false);
                clearTimeout(timeoutId);
            }
        });

        initSession();

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

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
            console.warn('Signout timeout:', err.message);
        } finally {
            localStorage.clear();
            sessionStorage.clear();
            const baseUrl = window.location.href.split('?')[0];
            window.location.href = baseUrl + '?logout=' + Date.now();
        }
    };

    const hardReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = window.location.href.split('?')[0];
    };

    return (
        <AuthContext.Provider value={{ user, isAdmin, loading, authLoading: loading, login, loginWithGoogle, logout, hardReset, version: VERSION }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
