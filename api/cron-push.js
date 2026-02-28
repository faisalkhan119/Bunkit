export default async function handler(req, res) {
    // 1. Authenticate the Cron request using Vercel's secret
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // 2. Call the Supabase Edge Function directly
        const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rqajrgqpfuqfvwveyqdh.supabase.co'; // Fallback if env not set for cron
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: '📚 BunkIt Daily Reminder',
                body: "Don't forget to review your classes and log your attendance today!",
                url: '/?openLog=true',
                audience: 'cron-all' // Explicitly trigger the SQL filtering for daily reminders
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Edge function failed: ${response.status} ${errBody}`);
        }

        const data = await response.json();

        return res.status(200).json({
            success: true,
            message: 'Cron triggered push successfully',
            details: data
        });

    } catch (error) {
        console.error('Cron push failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
