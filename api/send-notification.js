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
        const { tokens, title, body, data } = req.body;
        let targetTokens = [];

        // Priority 1: Tokens provided in request body (for testing/manual override)
        if (tokens && Array.isArray(tokens) && tokens.length > 0) {
            targetTokens = tokens;
            console.log(`Using ${targetTokens.length} tokens provided in request.`);
        }
        // Priority 2: Fetch enabled tokens from Firestore based on time
        else {
            // Calculate current time in IST (UTC+5:30)
            const now = new Date();
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(utcTime + istOffset);

            // Format to "HH:mm" (e.g., "09:05", "18:30")
            const hours = istDate.getHours().toString().padStart(2, '0');
            const minutes = istDate.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${hours}:${minutes}`;

            console.log(`Checking for reminders scheduled at ${currentTimeStr} IST...`);

            const db = admin.firestore();
            const snapshot = await db.collection('notification_tokens')
                .where('enabled', '==', true)
                .where('reminderTime', '==', currentTimeStr) // Exact minute match
                .get();

            if (snapshot.empty) {
                console.log(`No subscribers found for ${currentTimeStr} IST.`);
                return res.status(200).json({ success: true, message: 'No subscribers for this time' });
            }

            targetTokens = snapshot.docs
                .map(doc => doc.data().token)
                .filter(t => t); // Filter out null/undefined

            console.log(`Found ${targetTokens.length} tokens for ${currentTimeStr}.`);
        }

        if (targetTokens.length === 0) {
            return res.status(400).json({ error: 'No valid tokens found to send to.' });
        }

        const message = {
            notification: {
                title: title || '📚 Bunk it Reminder',
                body: body || "Time to log today's attendance!"
            },
            data: data || { url: '/' },
            tokens: targetTokens // Send to multiple devices
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`Successfully sent: ${response.successCount}, Failed: ${response.failureCount}`);

        // Log failures
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Failed to send to token ${idx}:`, resp.error);
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
