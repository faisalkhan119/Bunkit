-- 1. Enable the pg_cron extension (requires superuser privileges, available in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the Daily Push Notification Job (5:00 PM IST = 11:30 AM UTC)
SELECT cron.schedule(
  'daily-bunkit-push',
  '30 11 * * *',
  $$
    SELECT net.http_post(
      url:='https://rqajrgqpfuqfvwveyqdh.supabase.co/functions/v1/send-push',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYWpyZ3FwZnVxZnZ3dmV5cWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI1NTQ2OSwiZXhwIjoyMDg0ODMxNDY5fQ.9k6jcMoE7p1bKV_14iCT5DmT1E7MVaMr0O4WcR6h-e0"}'::jsonb,
      body:='{"title": "📚 BunkIt Daily Reminder", "body": "Don''t forget to review your classes and log your attendance today!", "url": "/?openLog=true", "audience": "all"}'::jsonb
    );
  $$
);

-- How to manage this cron job later:
-- To view active jobs: SELECT * FROM cron.job;
-- To unschedule: SELECT cron.unschedule('daily-bunkit-push');
-- To view recent runs: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
