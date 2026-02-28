import { createClient } from '@supabase/supabase-js'

const SUPABASE_DIRECT_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ'

// 🔧 Jio Block Fix: Use Vercel proxy in production, direct URL in dev
const SUPABASE_URL = import.meta.env.DEV
    ? SUPABASE_DIRECT_URL
    : window.location.origin + '/api/supabase-proxy'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
