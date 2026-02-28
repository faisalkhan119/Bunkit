// Vercel Serverless Function: Supabase Reverse Proxy
// Fixes ISP blocks (e.g., Jio blocking supabase.co) by routing
// all Supabase traffic through YOUR Vercel domain.
//
// Route: /api/supabase-proxy/:path* → https://rqajrgqpfuqfvwveyqdh.supabase.co/:path*

const SUPABASE_ORIGIN = 'https://rqajrgqpfuqfvwveyqdh.supabase.co';

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // req.query.path is set by vercel.json rewrite: /api/supabase-proxy/:path* → ?path=:path*
        // It may be a string like "rest/v1/table" or array ["rest","v1","table"]
        const pathParts = req.query.path;
        const subpath = Array.isArray(pathParts)
            ? pathParts.join('/')
            : (pathParts || '');

        // Build query string — remove the 'path' param added by the rewrite, keep the rest
        const forwardQuery = { ...req.query };
        delete forwardQuery.path;
        const qs = new URLSearchParams(forwardQuery).toString();

        const targetUrl = `${SUPABASE_ORIGIN}/${subpath}${qs ? '?' + qs : ''}`;

        // Forward headers, replacing host
        const forwardHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (key.toLowerCase() === 'host') continue;
            forwardHeaders[key] = value;
        }
        forwardHeaders['host'] = 'rqajrgqpfuqfvwveyqdh.supabase.co';

        // Read body for non-GET requests
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
        });

        // Forward Supabase response headers back (skip hop-by-hop)
        const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
        supabaseRes.headers.forEach((value, key) => {
            if (!skipHeaders.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        const responseBody = await supabaseRes.arrayBuffer();
        res.status(supabaseRes.status).end(Buffer.from(responseBody));

    } catch (err) {
        console.error('Supabase proxy error:', err);
        res.status(500).json({ error: 'Proxy failed: ' + err.message });
    }
};
