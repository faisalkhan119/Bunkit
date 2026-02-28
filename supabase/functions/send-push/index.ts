// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
// @ts-ignore
import webpush from 'npm:web-push@3.6.7'

// Declare Deno for local IDE TypeScript checks (Supabase Edge uses Deno natively)
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: any) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Initialize Supabase Client
        // We use the service_role key to bypass RLS and read ALL push_subscriptions
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 2. Parse Request Payload
        const params = await req.json()
        // Support Webhook formats (record) or Manual API formats
        const isWebhook = !!params.record

        let title = 'BunkIt Update'
        let body = 'You have a new notification.'
        let url = '/'
        let audience = 'all' // 'all', class_id, or email
        let filterEmail = null

        if (isWebhook && params.table === 'mass_bunk_polls') {
            // 2A. Triggered by a Mass Bunk Poll creation
            const poll = params.record
            title = `New Bunk Poll for ${poll.subject_name}`
            body = `${poll.bunk_date} - Cast your vote inside the app now!`
            url = '/app.html#bunk/polls'
            audience = poll.shared_class_id // we should notify users who are in this class
        } else {
            // 2B. Manual Admin Push or Vercel Cron
            title = params.title || title
            body = params.body || body
            url = params.url || url
            audience = params.audience || 'all'
            filterEmail = params.email || null
        }

        // 3. Configure Web Push
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
        if (!vapidPrivateKey) {
            throw new Error('Missing VAPID_PRIVATE_KEY in Secrets')
        }

        // We fetch the public key from the DB to keep things DRY, 
        // or just hardcode it here since we know it.
        const vapidPublicKey = 'BIfXWPJACpAP4dqjeLMCCVCUi94Nq5TJF3rxYWtQYeDBm8xpxRFBSQYy7iktweKJrmrrO84iIaRB_C6u0mfZ-AQ'

        webpush.setVapidDetails(
            'mailto:admin@bunkit.com',
            vapidPublicKey,
            vapidPrivateKey
        )

        // 4. Determine Target Users & Fetch Subscriptions
        let subscriptions: any[] = []

        if (audience === 'cron-all') {
            // ONLY send to users with Portal Mode ON and NO holiday today
            // Calculate today's date in IST (UTC + 5:30)
            const now = new Date()
            const nowIST = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
            const checkDateIST = nowIST.toISOString().split('T')[0]

            const { data: eligibleSubs, error: rpcErr } = await supabase.rpc(
                'get_daily_push_subscriptions',
                { check_date_ist: checkDateIST }
            )

            if (rpcErr) throw rpcErr
            subscriptions = eligibleSubs || []
        } else {
            let query = supabase.from('push_subscriptions').select('user_email, subscription_json')

            if (filterEmail && audience === 'specific_user') {
                query = query.eq('user_email', filterEmail)
            } else if (audience !== 'all') {
                // It's a class ID (Mass Bunk Poll)
                const { data: members, error: memErr } = await supabase
                    .from('class_memberships')
                    .select('user_email')
                    .eq('shared_class_id', audience)

                if (!memErr && members && members.length > 0) {
                    const emails = members.map((m: any) => m.user_email)
                    query = query.in('user_email', emails)
                } else {
                    return new Response(JSON.stringify({ message: "No members to notify" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
            }

            const { data, error: subErr } = await query
            if (subErr) throw subErr
            subscriptions = data || []
        }

        if (subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: "No active push subscriptions or eligible portal users found for this audience." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 5. Send Notifications
        const payload = JSON.stringify({ title, body, url })
        const results = await Promise.allSettled(
            subscriptions.map((sub: any) =>
                webpush.sendNotification(sub.subscription_json, payload)
            )
        )

        const successCount = results.filter((r: any) => r.status === 'fulfilled').length
        const failCount = results.length - successCount

        // (Optional) Here you could auto-delete subscriptions that threw a 410 Gone error.

        return new Response(
            JSON.stringify({
                success: true,
                message: `Sent ${successCount} successful pushes, ${failCount} failed.`,
                details: results
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Push Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
