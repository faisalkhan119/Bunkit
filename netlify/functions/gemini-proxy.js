// Netlify Serverless Function: Gemini API Proxy
// This hides your API key from client-side code

exports.handler = async (event, context) => {
    // CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get API key from environment variable (set in .env or Netlify Dashboard)
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY environment variable not set');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured on server' })
            };
        }

        // Parse the request body
        const requestBody = JSON.parse(event.body);
        const { action, prompt, imageData, mimeType } = requestBody;

        // Validate request
        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing action parameter' })
            };
        }

        let apiUrl, payload;

        switch (action) {
            case 'chat':
                // Simple text chat with Gemini
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
                // Image processing with Gemini Vision
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
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action: ' + action })
                };
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
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({
                    error: data.error?.message || 'Gemini API error',
                    details: data
                })
            };
        }

        // Return successful response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
