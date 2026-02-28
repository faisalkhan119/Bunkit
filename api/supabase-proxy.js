// Vercel Serverless Function: Supabase Reverse Proxy
// Fixes ISP blocks (e.g., Jio blocking supabase.co) by routing
// all Supabase traffic through YOUR Vercel domain.
//
// Route: /api/supabase-proxy/* → https://rqajrgqpfuqfvwveyqdh.supabase.co/*

const SUPABASE_URL = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';

module.exports = async function handler(req, res) {
    // Build the target Supabase path from the query param set by vercel.json rewrite
    // vercel.json rewrites /api/supabase-proxy/rest/v1/... → this function with ?path=rest/v1/...
    const subpath = req.query.path || '';
    const targetUrl = `${SUPABASE_URL}/${subpath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    // Forward all incoming headers except host
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() !== 'host') {
            forwardHeaders[key] = value;
        }
    }
    // Ensure Supabase host is set correctly
    forwardHeaders['host'] = 'rqajrgqpfuqfvwveyqdh.supabase.co';

    try {
        // Read request body for non-GET requests
        let body = undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            body = Buffer.concat(chunks);
        }

        const supabaseRes = await fetch(targetUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: body,
            redirect: 'follow',
        });

        // Forward response headers back to client
        const responseHeaders = {};
        supabaseRes.headers.forEach((value, key) => {
            // Skip hop-by-hop headers
            if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
                responseHeaders[key] = value;
            }
        });

        // CORS headers so browser doesn't complain
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Headers'] = '*';
        responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

        // Handle OPTIONS preflight
        if (req.method === 'OPTIONS') {
            return res.status(200).set(responseHeaders).end();
        }

        const responseBody = await supabaseRes.arrayBuffer();
        res.status(supabaseRes.status);
        Object.entries(responseHeaders).forEach(([k, v]) => res.setHeader(k, v));
        res.end(Buffer.from(responseBody));

    } catch (err) {
        console.error('Supabase proxy error:', err);
        res.status(500).json({ error: 'Proxy failed: ' + err.message });
    }
};
