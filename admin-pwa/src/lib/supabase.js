import { createClient } from '@supabase/supabase-js'

const SUPABASE_DIRECT_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ'

// 🔧 Jio ISP Block Fix:
// In production, use same-origin proxy (/sb-proxy) configured in vercel.json / netlify.toml.
// This avoids BOTH Jio's block on supabase.co AND cross-origin CORS issues.
// In dev, connect directly to Supabase (no ISP block on localhost).
const SUPABASE_URL = import.meta.env.DEV
    ? SUPABASE_DIRECT_URL
    : window.location.origin + '/sb-proxy'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
