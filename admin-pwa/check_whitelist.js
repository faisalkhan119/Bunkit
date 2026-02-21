import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ovjicpsswwndncsivmno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92amljcHNzd3duZG5jc2l2bW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MjM4NDAsImV4cCI6MjA1NDAwMTg0MH0.9A7Y7-GjE0G9vL80wB1_-6S5w_34M-3v-Q3v8S-6S5w';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWhitelist() {
    const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'admin_emails')
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Current Whitelist:', data.value);
}

checkWhitelist();
