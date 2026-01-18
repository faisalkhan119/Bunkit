// Helper script to encode your API keys to base64
// Usage: node encode-keys.js

const keys = [
    'YOUR_GEMINI_API_KEY_1',  // Replace with actual keys
    'YOUR_GEMINI_API_KEY_2',  // Add more keys for rotation
    'YOUR_GEMINI_API_KEY_3'
];

console.log('\n=== Base64 Encoded Keys ===\n');
keys.forEach((key, index) => {
    if (key.startsWith('YOUR_')) {
        console.log(`Key ${index + 1}: [PLACEHOLDER - Replace with actual key]`);
    } else {
        const encoded = Buffer.from(key).toString('base64');
        console.log(`Key ${index + 1}: '${encoded}',`);
    }
});

console.log('\n=== Instructions ===');
console.log('1. Replace YOUR_GEMINI_API_KEY_X with your actual API keys above');
console.log('2. Run: node encode-keys.js');
console.log('3. Copy the encoded keys');
console.log('4. Paste them in index.html at line ~16117 (obfuscatedKeys array)');
console.log('5. Delete this file after use for security\n');
