const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
const jsPath = path.join(__dirname, 'js', 'app.js');

const html = fs.readFileSync(indexPath, 'utf8');
const lines = html.split(/\r?\n/);

// Find the main <script> block containing "GLOBAL ERROR HANDLER"
let scriptStart = -1;
let scriptEnd = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '<script>' && scriptStart === -1) {
        // Check if the next few lines contain the GLOBAL ERROR HANDLER marker
        const nextLines = lines.slice(i + 1, i + 5).join(' ');
        if (nextLines.includes('GLOBAL ERROR HANDLER')) {
            scriptStart = i;
            console.log(`Found main script block start at line ${i + 1}: "${lines[i + 1].trim().substring(0, 50)}"`);
        }
    }
    if (scriptStart !== -1 && scriptEnd === -1 && lines[i].trim() === '</script>' && i > scriptStart + 100) {
        // Find the corresponding </script> — the one that ends the massive block
        // Check if the next line contains HTML, not more script content
        const nextLine = (lines[i + 1] || '').trim();
        if (nextLine.startsWith('<!--') || nextLine.startsWith('<div') || nextLine.startsWith('<') || nextLine === '') {
            scriptEnd = i;
            console.log(`Found main script block end at line ${i + 1}`);
            break;
        }
    }
}

if (scriptStart === -1 || scriptEnd === -1) {
    console.error('❌ Could not find main <script> block');
    process.exit(1);
}

const lineCount = scriptEnd - scriptStart - 1;
console.log(`\nMain script block: lines ${scriptStart + 1}-${scriptEnd + 1} (${lineCount} lines of JS)`);

// Extract JS content (exclude <script> and </script> tags)
const jsContent = lines.slice(scriptStart + 1, scriptEnd).join('\n');

// Write to js/app.js
fs.writeFileSync(jsPath, jsContent, 'utf8');
console.log(`✅ Wrote ${(jsContent.length / 1024).toFixed(1)} KB to js/app.js`);

// Replace the <script>...</script> block with <script src="js/app.js" defer>
const newLines = [
    ...lines.slice(0, scriptStart),
    '        <script src="js/app.js" defer></script>',
    ...lines.slice(scriptEnd + 1)
];

fs.writeFileSync(indexPath, newLines.join('\n'), 'utf8');
const newSize = fs.statSync(indexPath).size;
console.log(`✅ Replaced inline <script> with <script src="js/app.js" defer> in index.html`);
console.log(`   index.html: ${(newSize / 1024).toFixed(1)} KB (was 988 KB)`);
