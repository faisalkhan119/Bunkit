// Supabase Configuration
// Please replace the placeholders below with your actual Supabase URL and Anon Key.

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ';

let supabaseClient = null;

if (typeof supabase !== 'undefined') {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('⚠️ Supabase credentials not set. Please update js/supabase-config.js');
    } else {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase Client Initialized');
        } catch (e) {
            console.error('❌ Failed to initialize Supabase:', e);
            window.supabaseInitError = e;
        }
    }
} else {
    console.error('❌ Supabase SDK not loaded.');
    window.supabaseSDKError = true;
}

// Debug Helper
window.debugSupabaseConnection = async function () {
    if (window.supabaseSDKError) {
        alert("CRITICAL: The Supabase SDK script failed to load.\n\nPossible reasons:\n1. No Internet.\n2. 'unpkg.com' is blocked by your network/firewall.\n\nTry using a mobile hotspot or VPN.");
        return;
    }
    if (window.supabaseInitError) {
        alert("CRITICAL: Supabase Client failed to create.\nError: " + window.supabaseInitError.message);
        return;
    }
    if (!window.supabaseClient) {
        alert("CRITICAL: Supabase Client is NULL for an unknown reason.");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
            alert("CONNECTION FAILED:\n" + error.message + "\n\nHint: Check if your Project is PAUSED in Supabase Dashboard.");
        } else {
            alert("SUCCESS! Connected to Supabase.\n(Database is readable).");
        }
    } catch (err) {
        alert("NETWORK ERROR:\n" + err.message);
    }
};

// Make it globally available
window.supabaseClient = supabaseClient;
