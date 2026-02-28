// Test endpoint to verify API key configuration
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const sanitized = keysString.replace(/['"]/g, '');
    const keys = sanitized.split(',').map(k => k.trim()).filter(k => k.length > 0);

    return res.status(200).json({
        hasKeys: keys.length > 0,
        keyCount: keys.length,
        firstKeyPrefix: keys[0] ? keys[0].substring(0, 10) + '...' : 'NONE',
        firstKeyLength: keys[0]?.length || 0,
        startsWithAIza: keys[0]?.startsWith('AIza') || false,
        rawEnvLength: keysString.length,
        hasQuotes: /['"]/.test(process.env.GEMINI_API_KEYS || ''),
        envVarName: process.env.GEMINI_API_KEYS ? 'GEMINI_API_KEYS' :
            process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'NONE'
    });
};
