import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectData() {
    console.log('🧪 Inspecting app_config data types...');

    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('*')
            .in('key', ['daily_ad', 'calculate_ad']);

        if (error) {
            console.error('❌ Read failed:', error.message);
            return;
        }

        data.forEach(item => {
            console.log(`\nKey: ${item.key}`);
            console.log(`Type of value: ${typeof item.value}`);
            console.log('Value content:', item.value);

            if (typeof item.value === 'string') {
                try {
                    const parsed = JSON.parse(item.value);
                    console.log('✅ Value is a JSON string. Needs parsing.');
                    console.log('Parsed structure:', Object.keys(parsed));
                } catch (e) {
                    console.log('❌ Value is a plain string, not JSON.');
                }
            } else if (typeof item.value === 'object' && item.value !== null) {
                console.log('✅ Value is already an object (JSONB).');
                console.log('Object keys:', Object.keys(item.value));
            }
        });

    } catch (err) {
        console.error('🚫 Error:', err.message);
    }
}

inspectData();
