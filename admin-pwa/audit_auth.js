import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuthAndPermissions() {
    console.log('🧪 Starting Auth & Permission Audit...');

    try {
        // 1. Check current session (in node this will be empty unless we login)
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        console.log('👤 Current Session:', session ? 'Active' : 'Empty (Expected in node)');

        // 2. Try to read app_config as anon (to see if RLS allows reads)
        const { data: readData, error: readError } = await supabase
            .from('app_config')
            .select('*')
            .limit(1);

        if (readError) {
            console.log('❌ Anon Read Failed:', readError.message);
        } else {
            console.log('✅ Anon Read Success:', readData.length > 0 ? 'Data found' : 'Empty table');
        }

        // 3. Check table definition hints (using RPC if available or common error patterns)
        const { error: upsertError } = await supabase
            .from('app_config')
            .upsert({ key: 'audit_test', value: { test: true } })
            .select();

        if (upsertError) {
            console.log('❌ Anon Upsert Result:', upsertError.message);
            if (upsertError.message.includes('RLS')) {
                console.log('🎯 ROOT CAUSE FOUND: RLS policy blocking writes.');
            }
        } else {
            console.log('✅ Anon Upsert Success (Unexpected for production apps!)');
        }

    } catch (err) {
        console.error('🚫 Critical Audit Error:', err.message);
    }
}

checkAuthAndPermissions();
