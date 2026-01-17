// Vercel Serverless Function: Gemini API Proxy with Key Rotation
// This hides your API keys from client-side code
// Set GEMINI_API_KEYS in Vercel Dashboard as comma-separated values

// Simple in-memory key rotation (resets on cold start)
let currentKeyIndex = 0;
let exhaustedKeys = new Set();

module.exports = async function handler(req, res) {
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
        // Get API keys from environment (comma-separated)
        const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        // Sanitize keys: remove quotes, whitespace, and split
        const API_KEYS = keysString.replace(/['"]/g, '').split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (API_KEYS.length === 0) {
            console.error('No GEMINI_API_KEYS configured');
            return res.status(500).json({ error: 'API keys not configured on server' });
        }

        // Get next available key (skip exhausted ones)
        function getNextKey() {
            for (let i = 0; i < API_KEYS.length; i++) {
                const idx = (currentKeyIndex + i) % API_KEYS.length;
                if (!exhaustedKeys.has(idx)) {
                    currentKeyIndex = idx;
                    return { key: API_KEYS[idx], index: idx };
                }
            }
            return null; // All keys exhausted
        }

        let keyData = getNextKey();
        if (!keyData) {
            // Reset exhausted keys and try again (daily reset simulation)
            exhaustedKeys.clear();
            keyData = getNextKey();
            if (!keyData) {
                return res.status(429).json({ error: 'All API keys exhausted. Try again later.' });
            }
        }

        const GEMINI_API_KEY = keyData.key;
        const keyIndex = keyData.index;

        const { action, prompt, imageData, mimeType, systemPrompt } = req.body;

        if (!action) {
            return res.status(400).json({ error: 'Missing action parameter' });
        }

        let apiUrl, payload;

        switch (action) {
            case 'chat':
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
                payload = {
                    contents: [{
                        parts: systemPrompt
                            ? [{ text: systemPrompt }, { text: prompt }]
                            : [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    }
                };
                break;

            case 'vision':
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
            console.error(`Gemini API error (Key #${keyIndex + 1}):`, JSON.stringify(data, null, 2));
            console.error(`Request payload:`, JSON.stringify(payload, null, 2));
            console.error(`API URL:`, apiUrl.replace(/key=.*/, 'key=REDACTED'));

            // If quota exceeded, mark key as exhausted and rotate
            if (response.status === 429) {
                exhaustedKeys.add(keyIndex);
                currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
                console.log(`Key #${keyIndex + 1} exhausted, rotating to next key...`);
            }

            return res.status(response.status).json({
                error: data.error?.message || 'Gemini API error',
                details: data,
                debugInfo: {
                    model: 'gemini-2.5-flash',
                    action: action,
                    hasSystemPrompt: !!systemPrompt,
                    promptLength: prompt?.length || 0
                }
            });
        }

        // Rotate to next key for load balancing
        currentKeyIndex = (keyIndex + 1) % API_KEYS.length;

        return res.status(200).json(data);

    } catch (error) {
        console.error('Function error:', error);
        return res.status(500).json({ error: error.message });
    }
};
