// Vercel Serverless Function: Gemini API Proxy
// This hides your API key from client-side code

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get API key from environment (set in Vercel Dashboard or .env.local)
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY not set');
            return res.status(500).json({ error: 'API key not configured on server' });
        }

        const { action, prompt, imageData, mimeType } = req.body;

        if (!action) {
            return res.status(400).json({ error: 'Missing action parameter' });
        }

        let apiUrl, payload;

        switch (action) {
            case 'chat':
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
                payload = {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    }
                };
                break;

            case 'vision':
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
                payload = {
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType || 'image/jpeg',
                                    data: imageData
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 4096,
                    }
                };
                break;

            default:
                return res.status(400).json({ error: 'Invalid action: ' + action });
        }

        // Call Gemini API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Gemini API error',
                details: data
            });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Function error:', error);
        return res.status(500).json({ error: error.message });
    }
}
