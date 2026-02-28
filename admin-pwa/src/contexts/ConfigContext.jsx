import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ConfigContext = createContext({});

export const ConfigProvider = ({ children }) => {
    const { user, authLoading } = useAuth();
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllConfig = async (attempt = 1) => {
        // Always wait for auth to settle first
        if (authLoading) {
            console.log('⏳ Auth still loading, skipping config fetch');
            return;
        }

        if (!user) {
            console.log('👤 No user, clearing config');
            setConfig({});
            setLoading(false);
            return;
        }

        // Don't re-fetch if already loading (prevents double-fetches)
        setLoading(true);
        setError(null);
        console.log(`📦 Fetching configs (attempt ${attempt}/3) for:`, user.email);

        try {
            const { data, error: supabaseError } = await supabase
                .from('app_config')
                .select('key, value');

            if (supabaseError) {
                throw new Error(`Supabase error: ${supabaseError.message} (code: ${supabaseError.code})`);
            }

            if (!data || data.length === 0) {
                // Empty response - retry once to rule out transient errors
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
        } catch (err) {
            console.error('🚫 Config fetch failed:', err.message);
            setError(err.message);
            // Retry on network errors
            if (attempt < 3 && (err.message.includes('fetch') || err.message.includes('network'))) {
                console.warn(`🔄 Retrying config fetch in ${attempt}s...`);
                setTimeout(() => fetchAllConfig(attempt + 1), attempt * 1000);
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllConfig();
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
