import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpsert() {
    console.log('🧪 Starting upsert test (ESM)...');
    const start = Date.now();

    try {
        const { data, error } = await supabase
            .from('app_config')
            .upsert({
                key: 'test_connection',
                value: { timestamp: new Date().toISOString() },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })
            .select();

        const duration = Date.now() - start;
        if (error) {
            console.error('❌ Upsert failed:', error.message);
        } else {
            console.log('✅ Upsert successful!');
            console.log('⏱️ Duration:', duration, 'ms');
            console.log('📄 Data:', data);
        }
    } catch (err) {
        console.error('🚫 Critical error:', err.message);
    }
}

testUpsert();
