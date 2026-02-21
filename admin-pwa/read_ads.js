import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function readAds() {
    console.log('🧪 Reading Ad Configs...');

    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('*')
            .in('key', ['daily_ad', 'calculate_ad']);

        if (error) {
            console.error('❌ Read failed:', error.message);
        } else {
            console.log('✅ Read successful!');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('🚫 Error:', err.message);
    }
}

readAds();
