import { createClient } from '@supabase/supabase-js'

const SUPABASE_DIRECT_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ'

// 🔧 The admin panel is deployed separately from the main app (bunkitapp.in).
// It does NOT have the /api/supabase-proxy serverless function on its own origin.
// Using window.location.origin would hit the admin panel's own domain, returning
// an HTML 404 page instead of JSON — causing "Unexpected token 'T'" errors.
// 
// Fix: Use the main app's proxy in production (for Jio ISP block bypass),
// or direct Supabase URL in dev mode.
const MAIN_APP_PROXY_URL = 'https://bunkitapp.in/api/supabase-proxy'

const SUPABASE_URL = import.meta.env.DEV
    ? SUPABASE_DIRECT_URL
    : MAIN_APP_PROXY_URL

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
