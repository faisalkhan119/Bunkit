import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTU0NjksImV4cCI6MjA4NDgzMTQ2OX0.cz-FFffaB44rnvvoII755TZbxdJ9asIRFvEenDl2QdQ'

// 🔧 Admin panel connects directly to Supabase (no proxy needed).
// The Jio ISP proxy (/api/supabase-proxy) is only for the main user-facing app.
// Admin panel is a separate deployment — cross-origin requests to bunkitapp.in
// cause CORS/fetch failures, and admins don't need the Jio workaround anyway.

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
