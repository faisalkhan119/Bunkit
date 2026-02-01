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
        // Priority 2: Fetch all enabled tokens from Firestore
        else {
            console.log('Fetching tokens from Firestore...');
            const db = admin.firestore();
            const snapshot = await db.collection('notification_tokens')
                .where('enabled', '==', true)
                .get();

            if (snapshot.empty) {
                console.log('No enabled subscriber tokens found.');
                return res.status(200).json({ success: true, message: 'No subscribers found' });
            }

            targetTokens = snapshot.docs
                .map(doc => doc.data().token)
                .filter(t => t); // Filter out null/undefined

            console.log(`Found ${targetTokens.length} tokens in Firestore.`);
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
