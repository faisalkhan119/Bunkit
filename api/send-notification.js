// Vercel Serverless Function: Send FCM Notifications
// This is called by an external cron service (cron-job.org)

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

export default async function handler(req, res) {
    // Security: Verify request is from authorized source
    const authHeader = req.headers['authorization'];
    const expectedToken = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${expectedToken}`) {
        console.log('Unauthorized request to send-notification');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Get FCM tokens from request body or environment
        // For now, we'll accept tokens in the request
        const { tokens, title, body, data } = req.body;

        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
            return res.status(400).json({ error: 'No tokens provided' });
        }

        const message = {
            notification: {
                title: title || '📚 Bunk it Reminder',
                body: body || "Time to log today's attendance!"
            },
            data: data || { url: '/' },
            tokens: tokens // Send to multiple devices
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`Successfully sent: ${response.successCount}, Failed: ${response.failureCount}`);

        // Log failures for debugging
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.log(`Failed to send to token ${idx}: ${resp.error?.message}`);
                }
            });
        }

        return res.status(200).json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        });

    } catch (error) {
        console.error('FCM Send Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
