-- 1. Create a function to get eligible push subscriptions for the daily cron
-- This function joins push_subscriptions with classes (via auth.users)
-- to ensure we ONLY notify users who have Portal Mode ON and NO holiday today.

CREATE OR REPLACE FUNCTION get_daily_push_subscriptions(check_date_ist text)
RETURNS TABLE (
    subscription_json jsonb
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ps.subscription_json
    FROM push_subscriptions ps
    JOIN auth.users au ON au.email = ps.user_email
    JOIN classes c ON c.user_id = au.id
    WHERE 
        -- 1. Portal mode must be active
        (c.data->'portalSetup'->>'active')::boolean = true
        -- 2. Today's date must NOT be in the holidays array
        AND NOT (
            COALESCE(c.data->'holidays', '[]'::jsonb) @> to_jsonb(check_date_ist)
        );
END;
$$ LANGUAGE plpgsql;

-- To test it manually (optional):
-- SELECT * FROM get_daily_push_subscriptions('2024-11-20');
