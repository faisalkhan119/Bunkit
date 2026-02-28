import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
const VERSION = "2.0.4";

const getCachedState = () => {
    try {
        const cachedAdminEmail = localStorage.getItem('bunkit_admin_cache');
        if (cachedAdminEmail) {
            // Find the supabase auth token in localStorage.
            const sbKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
            if (sbKey) {
                const sbData = JSON.parse(localStorage.getItem(sbKey));
                const sessionUser = sbData?.user;
                if (sessionUser && sessionUser.email === cachedAdminEmail) {
                    return { user: sessionUser, isAdmin: true, loading: false };
                }
            }
        }
    } catch (e) {
        console.warn('Failed to parse cached auth state:', e);
    }
    return { user: null, isAdmin: null, loading: true };
};

export const AuthProvider = ({ children }) => {
    const cachedState = getCachedState();
    const [user, setUser] = useState(cachedState.user);
    const [loading, setLoading] = useState(cachedState.loading);
    const [isAdmin, setIsAdmin] = useState(cachedState.isAdmin);
    const [adminCheckError, setAdminCheckError] = useState(null);

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
                new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'Admin check timeout', code: 'TIMEOUT' } }), 5000))
            ]);

            if (error) {
                if (retries > 0) {
                    console.warn(`🔄 Retrying admin check in 2s... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return checkAdmin(email, retries - 1);
                }

                setAdminCheckError(`${error.code || 'UNKNOWN'}: ${error.message || 'Network/Server Error'}`);
                throw error;
            }

            const adminEmails = Array.isArray(data?.value) ? data.value : [];
            const normalizedUserEmail = email.trim().toLowerCase();
            const isWhitelisted = adminEmails.some(e => {
                if (typeof e !== 'string') return false;
                return e.trim().toLowerCase() === normalizedUserEmail;
            });

            console.log(isWhitelisted ? '✅ Admin verified' : '❌ Not in whitelist');

            if (!isWhitelisted) {
                setAdminCheckError(`Email ${normalizedUserEmail} not found in whitelist.`);
                localStorage.removeItem('bunkit_admin_cache');
            } else {
                setAdminCheckError(null);
                localStorage.setItem('bunkit_admin_cache', normalizedUserEmail);
            }

            setIsAdmin(isWhitelisted);
            return isWhitelisted;
        } catch (err) {
            console.error('🚫 Error checking admin status:', err.message);
            // Optimistic Auth Bypass: If we are already an admin via cache, ignore the network error!
            if (isAdmin === true) {
                console.warn('🤫 Ignoring checkAdmin error because optimistic cache is active.');
                return true;
            }
            if (!adminCheckError) setAdminCheckError(`Runtime Error: ${err.message}`);
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
                if (isAdmin === null) {
                    setAdminCheckError("INIT_TIMEOUT: The 25-second global initialization timeout was reached. Network or database is unresponsive.");
                    setIsAdmin(false);
                }
            }
        }, 25000);

        const initSession = async () => {
            console.log('🏁 Portal Init started...');
            try {
                // Bug fix #8: Add strict 5s timeout to getSession so it doesn't hang infinitely on resume
                let sessionResult;
                try {
                    sessionResult = await Promise.race([
                        supabase.auth.getSession(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GET_SESSION_TIMEOUT: Token refresh hung.')), 5000))
                    ]);
                } catch (e) {
                    console.warn('🔄 getSession fetch timed out. OS network might be sleeping. Fast failing.');
                    // Optimistic Auth Bypass: If cache is active, silently swallow the error to prevent Access Denied screen.
                    if (isAdmin === true && user !== null) {
                        console.warn('🤫 Swallowing getSession timeout because optimistic cache is already driving the UI.');
                        if (mounted) {
                            authStateFetched = true;
                            setLoading(false);
                            clearTimeout(timeoutId);
                        }
                        return;
                    }
                    throw e; // Handled below in outer catch block
                }

                const { data: { session } } = sessionResult;
                if (!mounted || authStateFetched) return;

                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await checkAdmin(currentUser.email, 2); // Pass explicit 2 retries (Total time: ~15s max)
                } else {
                    setAdminCheckError("NO_USER: Session exists but currentUser is null.");
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error('Portal: Session fetch failed:', err);
                if (mounted) {
                    setAdminCheckError(`SESSION_FETCH_ERROR: ${err.message}`);
                    setIsAdmin(false);
                }
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
                    setAdminCheckError("AUTH_EVENT_NO_USER: Auth state changed, but user is null.");
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error('Portal: Auth event logic failed:', err);
                setAdminCheckError(`AUTH_EVENT_ERROR: ${err.message}`);
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
        <AuthContext.Provider value={{ user, isAdmin, loading, authLoading: loading, adminCheckError, login, loginWithGoogle, logout, hardReset, version: VERSION }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
