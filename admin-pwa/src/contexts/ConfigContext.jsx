import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ConfigContext = createContext({});

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllConfig = async () => {
        setLoading(true);
        try {
            const { data, error: supabaseError } = await supabase
                .from('app_config')
                .select('key, value');

            if (supabaseError) throw supabaseError;

            // Convert array to key-value map
            const configMap = data.reduce((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {});

            setConfig(configMap);
            setError(null);
        } catch (err) {
            console.error('Error fetching config:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllConfig();
    }, []);

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
