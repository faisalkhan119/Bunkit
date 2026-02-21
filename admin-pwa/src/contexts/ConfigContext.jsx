import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ConfigContext = createContext({});

export const ConfigProvider = ({ children }) => {
    const { user } = useAuth();
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllConfig = async () => {
        if (!user) {
            setConfig({});
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log('📦 Fetching all configs...');

        // Safety timeout for config fetch
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn('⚠️ Config fetch timed out');
                setLoading(false);
            }
        }, 6000);

        try {
            const { data, error: supabaseError } = await supabase
                .from('app_config')
                .select('key, value');

            if (supabaseError) throw supabaseError;

            const configMap = (data || []).reduce((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {});

            console.log('✅ Configs loaded:', Object.keys(configMap));
            setConfig(configMap);
            setError(null);
        } catch (err) {
            console.error('🚫 Error fetching config:', err);
            setError(err.message);
        } finally {
            setLoading(false);
            clearTimeout(timeoutId);
        }
    };

    useEffect(() => {
        fetchAllConfig();
    }, [user?.id]); // Re-fetch when user changes

    const refreshConfig = () => fetchAllConfig();

    const updateConfig = async (key, value) => {
        try {
            const { error: upsertError } = await supabase
                .from('app_config')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (upsertError) throw upsertError;

            // Optimistic update
            setConfig(prev => ({ ...prev, [key]: value }));
            return { success: true };
        } catch (err) {
            console.error(`Error updating config [${key}]:`, err);
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
