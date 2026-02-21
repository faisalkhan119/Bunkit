import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
const VERSION = "2.0.1";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(null);

    const checkAdmin = async (email, retries = 3) => {
        if (!email) {
            setIsAdmin(false);
            return false;
        }
        try {
            console.log(`🔐 [Auth v${VERSION}] Checking admin: ${email.toLowerCase()}`);

            const fetchConfig = supabase
                .from('app_config')
                .select('value')
                .eq('key', 'admin_emails')
                .single();

            const { data, error } = await Promise.race([
                fetchConfig,
                new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'Admin check timeout', code: 'TIMEOUT' } }), 10000))
            ]);

            if (error) {
                if (retries > 0) {
                    console.warn(`🔄 Retrying admin check in 2s... (${retries} retries left)`);

                    // Add 2-second sleep to allow mobile OS network to wake up on PWA resume 
                    await new Promise(resolve => setTimeout(resolve, 2000));

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
            console.error('🚫 Error checking admin status:', err.message);
            setIsAdmin(false);
            return false;
        }
    };

    useEffect(() => {
        let mounted = true;
        let authStateFetched = false;

        const timeoutId = setTimeout(() => {
            if (mounted && loading) {
                console.warn('⚠️ Auth initialization timed out (25s)');
                setLoading(false);
                if (isAdmin === null) setIsAdmin(false);
            }
        }, 25000);

        const initSession = async () => {
            console.log('🏁 Portal Init started...');
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!mounted || authStateFetched) return;

                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await checkAdmin(currentUser.email);
                } else {
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error('Portal: Session fetch failed:', err);
                if (mounted) setIsAdmin(false);
            } finally {
                if (mounted) {
                    authStateFetched = true;
                    setLoading(false);
                    clearTimeout(timeoutId);
                    console.log('🏁 Portal Init complete');
                }
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            console.log('📡 Auth State Change:', event);

            // If it's the initial session event, don't overlap with initSession
            if (event === 'INITIAL_SESSION' && authStateFetched) return;

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
                if (mounted) {
                    authStateFetched = true;
                    setLoading(false);
                    clearTimeout(timeoutId);
                }
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
