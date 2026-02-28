-- ==========================================
-- Admin Panel Schema Fix
-- ==========================================
-- The Admin Panel (Analytics & User Lookup) requires 
-- these columns to function correctly.

-- 1. Add missing columns to the public profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- 2. Backfill existing data from the secure auth.users table
UPDATE public.profiles p
SET 
    email = u.email,
    last_seen = u.last_sign_in_at,
    auth_provider = CASE WHEN u.raw_app_meta_data->>'provider' IS NOT NULL THEN u.raw_app_meta_data->>'provider' ELSE 'email' END
FROM auth.users u
WHERE p.id = u.id;

-- 2.5 INSERT completely missing profiles from auth.users
INSERT INTO public.profiles (id, full_name, email, auth_provider)
SELECT 
    u.id, 
    u.raw_user_meta_data->>'full_name', 
    u.email, 
    CASE WHEN u.raw_app_meta_data->>'provider' IS NOT NULL THEN u.raw_app_meta_data->>'provider' ELSE 'email' END
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 3. (Optional but recommended) 
-- Update your existing Profile Trigger to keep email synced on new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, auth_provider)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_app_meta_data->>'provider'
  );
  RETURN new;
END;
$$;

-- 4. Allow Admins to read all profiles (Required for Analytics & Lookup)
-- First ensure RLS is enabled on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Then add the policy for admins
DROP POLICY IF EXISTS "Admins can view all profiles for analytics" ON public.profiles;
CREATE POLICY "Admins can view all profiles for analytics" 
ON public.profiles 
FOR SELECT 
USING (auth.email() IN (
    SELECT jsonb_array_elements_text(value) FROM public.app_config WHERE key = 'admin_emails'
));
