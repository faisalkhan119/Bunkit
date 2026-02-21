import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdData() {
    console.log('🔍 Reading all app_config rows...');
    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['daily_ad', 'calculate_ad', 'admin_emails']);

    if (error) {
        console.error('❌ Read Error:', error.message);
    } else {
        console.log('✅ Data in database:');
        data.forEach(row => {
            console.log(`\n🔑 Key: ${row.key}`);
            console.log(`📦 Value Type: ${typeof row.value}`);
            console.log(`📄 Value:`, JSON.stringify(row.value, null, 2));
        });
    }
}

checkAdData();
