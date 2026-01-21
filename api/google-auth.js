// Vercel Serverless Function: Google OAuth Token Exchange
// This handles authorization code exchange and token refresh
// Keeps client_secret secure on server-side

const crypto = require('crypto');

// Environment variables (set in Vercel Dashboard):
// GOOGLE_CLIENT_ID - Your Google OAuth Client ID
// GOOGLE_CLIENT_SECRET - Your Google OAuth Client Secret
// TOKEN_ENCRYPTION_KEY - 32-character key for encrypting refresh tokens

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Simple encryption for refresh tokens
function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, key) {
    try {
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

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

    const { action, code, refreshToken, redirectUri } = req.body;

    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'bunkit-default-key-change-me!!!';

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error: Missing OAuth credentials' });
    }

    try {
        // === ACTION: EXCHANGE AUTHORIZATION CODE FOR TOKENS ===
        if (action === 'exchange') {
            if (!code) {
                return res.status(400).json({ error: 'Authorization code required' });
            }

            const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code: code,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: redirectUri || 'postmessage',
                    grant_type: 'authorization_code'
                })
            });

            const tokenData = await tokenResponse.json();

            if (tokenData.error) {
                console.error('Token exchange error:', tokenData);
                return res.status(400).json({ error: tokenData.error_description || tokenData.error });
            }

            // Encrypt refresh token before sending to client
            let encryptedRefreshToken = null;
            if (tokenData.refresh_token) {
                encryptedRefreshToken = encrypt(tokenData.refresh_token, ENCRYPTION_KEY);
            }

            return res.status(200).json({
                access_token: tokenData.access_token,
                expires_in: tokenData.expires_in,
                token_type: tokenData.token_type,
                scope: tokenData.scope,
                // Send encrypted refresh token to client for storage
                encrypted_refresh_token: encryptedRefreshToken
            });
        }

        // === ACTION: REFRESH ACCESS TOKEN ===
        if (action === 'refresh') {
            if (!refreshToken) {
                return res.status(400).json({ error: 'Refresh token required' });
            }

            // Decrypt the refresh token
            const decryptedRefreshToken = decrypt(refreshToken, ENCRYPTION_KEY);
            if (!decryptedRefreshToken) {
                return res.status(400).json({ error: 'Invalid refresh token' });
            }

            const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    refresh_token: decryptedRefreshToken,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: 'refresh_token'
                })
            });

            const tokenData = await tokenResponse.json();

            if (tokenData.error) {
                console.error('Token refresh error:', tokenData);
                // If refresh token is invalid/revoked, tell client to re-authenticate
                if (tokenData.error === 'invalid_grant') {
                    return res.status(401).json({
                        error: 'Token expired or revoked',
                        requireReauth: true
                    });
                }
                return res.status(400).json({ error: tokenData.error_description || tokenData.error });
            }

            return res.status(200).json({
                access_token: tokenData.access_token,
                expires_in: tokenData.expires_in,
                token_type: tokenData.token_type
            });
        }

        // === ACTION: REVOKE TOKEN ===
        if (action === 'revoke') {
            if (!refreshToken) {
                return res.status(400).json({ error: 'Refresh token required' });
            }

            const decryptedRefreshToken = decrypt(refreshToken, ENCRYPTION_KEY);
            if (!decryptedRefreshToken) {
                return res.status(200).json({ success: true }); // Already invalid, consider it revoked
            }

            // Revoke with Google
            await fetch(`https://oauth2.googleapis.com/revoke?token=${decryptedRefreshToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action. Use: exchange, refresh, or revoke' });

    } catch (error) {
        console.error('Google Auth API error:', error);
        return res.status(500).json({ error: 'Server error: ' + error.message });
    }
};
