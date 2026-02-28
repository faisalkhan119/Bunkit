-- ==========================================
-- 1. Create push_subscriptions Table
-- ==========================================
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_email TEXT NOT NULL,
    device_id TEXT NOT NULL,
    subscription_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_email, device_id)
);

-- Turn on RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert/update their own subscriptions
CREATE POLICY "Users can manage their own push subscriptions" 
ON push_subscriptions 
FOR ALL 
USING (auth.email() = user_email)
WITH CHECK (auth.email() = user_email);

-- Allow admins to read all subscriptions (for manual push)
CREATE POLICY "Admins can view all push subscriptions" 
ON push_subscriptions 
FOR SELECT 
USING (auth.email() IN (
    SELECT jsonb_array_elements_text(value) FROM app_config WHERE key = 'admin_emails'
));

-- ==========================================
-- 2. Insert VAPID_PUBLIC_KEY into app_config
-- ==========================================
-- This makes the public key available to the frontend securely
INSERT INTO app_config (key, value)
VALUES (
    'vapid_public_key', 
    '"BIfXWPJACpAP4dqjeLMCCVCUi94Nq5TJF3rxYWtQYeDBm8xpxRFBSQYy7iktweKJrmrrO84iIaRB_C6u0mfZ-AQ"'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ==========================================
-- 3. Database Webhook (Trigger for Mass Bunk Polls)
-- ==========================================
-- Note: Replace [YOUR_PROJECT_REF] when deploying this webhook
-- And ensure you add the SUPABASE_SERVICE_ROLE_KEY to the headers in the Dashboard UI.

-- The actual trigger will be created via the Supabase Dashboard Webhooks UI:
-- 1. Go to Database -> Webhooks
-- 2. Create Webhook: "Mass Bunk Poll Created"
-- 3. Table: mass_bunk_polls
-- 4. Events: Insert
-- 5. Type: HTTP Request
-- 6. Method: POST
-- 7. URL: https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-push
-- 8. HTTP Headers: 
--      Content-Type: application/json
--      Authorization: Bearer [YOUR_ANON_OR_SERVICE_ROLE_KEY]
