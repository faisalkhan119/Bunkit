const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
const cssDir = path.join(__dirname, 'css');
const cssPath = path.join(cssDir, 'styles.css');

// Read index.html
const html = fs.readFileSync(indexPath, 'utf8');
const lines = html.split(/\r?\n/);

// Find the main <style> block (first one, at line ~643)
let styleStart = -1;
let styleEnd = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '<style>' && styleStart === -1) {
        // Skip the very first small <style> blocks if any — we want the big one
        // The main CSS block starts with "/* --- MODERN UI" comment
        if (i + 1 < lines.length && lines[i + 1].includes('MODERN UI')) {
            styleStart = i;
        }
    }
    if (styleStart !== -1 && styleEnd === -1 && lines[i].trim() === '</style>') {
        styleEnd = i;
        break;
    }
}

if (styleStart === -1 || styleEnd === -1) {
    console.error('❌ Could not find main <style> block');
    process.exit(1);
}

console.log(`Found main CSS block: lines ${styleStart + 1} to ${styleEnd + 1} (${styleEnd - styleStart - 1} lines of CSS)`);

// Extract CSS content (exclude <style> and </style> tags)
const cssContent = lines.slice(styleStart + 1, styleEnd).join('\n');

// Create css directory if needed
if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
}

// Write CSS to file
fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log(`✅ Wrote ${(cssContent.length / 1024).toFixed(1)} KB to css/styles.css`);

// Replace the <style>...</style> block with a <link> tag
const newLines = [
    ...lines.slice(0, styleStart),
    '    <link rel="stylesheet" href="css/styles.css">',
    ...lines.slice(styleEnd + 1)
];

fs.writeFileSync(indexPath, newLines.join('\n'), 'utf8');
console.log(`✅ Replaced inline <style> with <link> in index.html`);
console.log(`   index.html: ${(fs.statSync(indexPath).size / 1024).toFixed(1)} KB (was ~1135 KB)`);
