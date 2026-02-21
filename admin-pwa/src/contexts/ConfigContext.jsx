import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ConfigContext = createContext({});

export const ConfigProvider = ({ children }) => {
    const { user, authLoading } = useAuth();
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllConfig = async () => {
        // Wait for Auth to finish initializing before deciding what to do
        if (authLoading) return;

        if (!user) {
            console.log('👤 No user session, skipping config fetch');
            setConfig({});
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log('📦 Fetching all configs for user:', user.email);

        // Safety timeout to prevent infinite spinner
        const timeoutId = setTimeout(() => {
            console.warn('⚠️ Config fetch timed out after 7s');
            setLoading(false);
        }, 7000);

        try {
            const { data, error: supabaseError } = await supabase
                .from('app_config')
                .select('key, value');

            console.log('✅ Configs sync complete. Raw rows:', data?.length);
            const configMap = (data || []).reduce((acc, item) => {
                if (item.key) acc[item.key] = item.value;
                return acc;
            }, {});

            console.log('🗺️ Config Map Keys:', Object.keys(configMap));
            setConfig(configMap);
            setError(null);
        } catch (err) {
            console.error('🚫 Config fetch failed:', err);
            setError(err.message);
            // Even on error, we must allow the app to render with whatever it has
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllConfig();
    }, [user?.id, authLoading]); // Re-run when session settles or user changes

    const refreshConfig = () => fetchAllConfig();

    const updateConfig = async (key, value) => {
        console.log(`💾 Saving config [${key}]...`);
        try {
            // 10 second timeout for save
            const savePromise = supabase
                .from('app_config')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Save timeout after 10s')), 10000)
            );

            const { error: upsertError } = await Promise.race([savePromise, timeoutPromise]);

            if (upsertError) throw upsertError;

            // Optimistic update
            setConfig(prev => ({ ...prev, [key]: value }));
            console.log(`✅ Config [${key}] saved successfully`);
            return { success: true };
        } catch (err) {
            console.error(`🚫 Error updating config [${key}]:`, err);
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
