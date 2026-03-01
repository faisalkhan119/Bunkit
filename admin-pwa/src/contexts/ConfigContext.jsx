import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ConfigContext = createContext({});

export const ConfigProvider = ({ children }) => {
    const { user, authLoading, isAdmin } = useAuth();
    const [config, setConfig] = useState(() => {
        // Optimistic: try to load config from localStorage cache
        try {
            const cached = localStorage.getItem('bunkit_admin_config_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                console.log('📦 Loaded config from cache, keys:', Object.keys(parsed));
                return parsed;
            }
        } catch (e) { /* ignore */ }
        return {};
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllConfig = async (attempt = 1) => {
        // Wait for auth to fully settle — don't fetch during transition
        if (authLoading) {
            console.log('⏳ Auth still loading, skipping config fetch');
            return;
        }

        // Only clear config on explicit logout (no user AND not loading)
        // Don't clear during transient auth states to prevent flash-of-zeros
        if (!user) {
            console.log('👤 No user, clearing config');
            setConfig({});
            localStorage.removeItem('bunkit_admin_config_cache');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        console.log(`📦 Fetching configs (attempt ${attempt}/3) for:`, user.email);

        try {
            const fetchPromise = supabase
                .from('app_config')
                .select('key, value');

            // Add a 10s timeout to prevent hanging forever
            const { data, error: supabaseError } = await Promise.race([
                fetchPromise,
                new Promise((resolve) =>
                    setTimeout(() => resolve({ data: null, error: { message: 'Config fetch timeout (10s)', code: 'TIMEOUT' } }), 10000)
                )
            ]);

            if (supabaseError) {
                throw new Error(`Supabase error: ${supabaseError.message} (code: ${supabaseError.code})`);
            }

            if (!data || data.length === 0) {
                if (attempt < 3) {
                    console.warn(`⚠️ Config fetch returned empty on attempt ${attempt}, retrying in 1s...`);
                    setTimeout(() => fetchAllConfig(attempt + 1), 1000);
                    return;
                }
                console.warn('⚠️ Config is genuinely empty after 3 attempts');
            }

            const configMap = (data || []).reduce((acc, item) => {
                if (item.key) acc[item.key] = item.value;
                return acc;
            }, {});

            console.log('✅ Configs loaded. Keys:', Object.keys(configMap));
            setConfig(configMap);
            setError(null);

            // Cache config for instant display on next refresh
            try {
                localStorage.setItem('bunkit_admin_config_cache', JSON.stringify(configMap));
            } catch (e) { /* full storage, ignore */ }
        } catch (err) {
            console.error('🚫 Config fetch failed:', err.message);
            setError(err.message);
            // Retry on network/timeout errors
            if (attempt < 3 && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('timeout') || err.message.includes('TIMEOUT'))) {
                console.warn(`🔄 Retrying config fetch in ${attempt}s...`);
                setTimeout(() => fetchAllConfig(attempt + 1), attempt * 1000);
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch when auth is settled AND we have a user
        if (!authLoading && user?.id) {
            fetchAllConfig();
        } else if (!authLoading && !user) {
            // Explicit no-user state after auth settled — clear config
            setConfig({});
            localStorage.removeItem('bunkit_admin_config_cache');
            setLoading(false);
        }
    }, [user?.id, authLoading]); // Re-run when session settles or user changes

    const refreshConfig = () => fetchAllConfig();

    const updateConfig = async (key, value) => {
        console.log(`💾 Saving config [${key}]...`, value);
        try {
            const savePromise = supabase
                .from('app_config')
                .upsert(
                    { key, value },
                    { onConflict: 'key' }
                )
                .select();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Save timeout after 15s')), 15000)
            );

            const { data: savedData, error: upsertError } = await Promise.race([savePromise, timeoutPromise]);

            if (upsertError) throw upsertError;

            console.log(`✅ Config [${key}] saved. DB response:`, savedData);
            // Optimistic update - sync memory with what we just saved
            setConfig(prev => ({ ...prev, [key]: value }));
            return { success: true };
        } catch (err) {
            console.error(`🚫 Error updating config [${key}]:`, err.message);
            return { success: false, error: err.message };
        }
    };

    return (
        <ConfigContext.Provider value={{ config, loading, error, refreshConfig, updateConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
