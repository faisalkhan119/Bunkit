const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

// Extensions to copy
const extensions = ['.html', '.js', '.json', '.xml', '.txt', '.png', '.ico', '.toml'];
// Files to explicitly include
const files = [
    'index.html',
    'offline.html',
    'privacy.html',
    'terms.html',
    'about.html',
    'contact.html',
    'faq.html',
    'support.html',
    'sw.js',
    'manifest.json',
    'robots.txt',
    'sitemap.xml',
    'vercel.json',
    'netlify.toml'
];

// Directories to copy
const directories = ['js', 'css', 'assets', 'images', 'icons', 'api', 'netlify', '.well-known'];

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const JavaScriptObfuscator = require('javascript-obfuscator');

console.log('📦 Starting optimized + obfuscated build...\n');

// ========== OBFUSCATION CONFIG ==========
const obfuscatorConfig = {
    compact: true,
    controlFlowFlattening: false,        // Disabled — too slow for 600KB+ files
    deadCodeInjection: false,            // Disabled — increases file size too much
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,                // Keep globals accessible for inline scripts
    selfDefending: false,                // Disabled — can break in strict mode
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.5,           // Encode 50% of strings
    splitStrings: true,
    splitStringsChunkLength: 10,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Lighter config for small scripts
const lightObfuscatorConfig = {
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayThreshold: 0.3,
    transformObjectKeys: true
};

// ========== MINIFICATION HELPERS ==========

function minifyCSS(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')          // Remove comments
        .replace(/\s+/g, ' ')                       // Collapse whitespace
        .replace(/\s*([{}:;,>~+])\s*/g, '$1')       // Remove space around selectors
        .replace(/;}/g, '}')                         // Remove last semicolon
        .trim();
}

function obfuscateJS(js, filename) {
    try {
        const isLargeFile = js.length > 100000;
        const config = isLargeFile ? obfuscatorConfig : lightObfuscatorConfig;
        const result = JavaScriptObfuscator.obfuscate(js, config);
        return result.getObfuscatedCode();
    } catch (e) {
        console.warn(`⚠️ Obfuscation failed for ${filename}: ${e.message}. Using basic minification.`);
        // Fallback: basic whitespace removal
        return js
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

function minifyAndObfuscateHTML(html) {
    // 1. Extract and obfuscate inline <script> blocks
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (match, code) => {
        if (code.trim().length < 20) return match; // Skip tiny scripts
        try {
            const obfuscated = obfuscateJS(code, 'inline-script');
            return `<script>${obfuscated}</script>`;
        } catch (e) {
            return match; // Keep original on failure
        }
    });

    // 2. Minify HTML structure
    return html
        .replace(/<!--[\s\S]*?-->/g, '')             // Remove HTML comments
        .replace(/>\s+</g, '><')                     // Collapse whitespace between tags
        .replace(/\s{2,}/g, ' ')                     // Collapse remaining whitespace
        .trim();
}

let totalSaved = 0;

// Helper: Copy file with optional minification
function copyFile(src, dest, minify = false) {
    if (fs.existsSync(src)) {
        if (minify) {
            const content = fs.readFileSync(src, 'utf8');
            const ext = path.extname(src).toLowerCase();
            let minified = content;

            if (ext === '.css') minified = minifyCSS(content);
            else if (ext === '.js') minified = obfuscateJS(content, path.basename(src));
            else if (ext === '.html') minified = minifyAndObfuscateHTML(content);

            const saved = content.length - minified.length;
            totalSaved += saved;
            fs.writeFileSync(dest, minified, 'utf8');
            const pct = content.length > 0 ? ((saved / content.length) * 100).toFixed(0) : 0;
            console.log(`✓ ${path.basename(src)} ${(content.length / 1024).toFixed(1)}KB → ${(minified.length / 1024).toFixed(1)}KB (-${pct}%)`);
        } else {
            fs.copyFileSync(src, dest);
            console.log(`✓ Copied ${path.basename(src)}`);
        }
    } else {
        console.log(`⚠️ Missing ${path.basename(src)}`);
    }
}

// Helper: Copy directory recursive with minification
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            const shouldMinify = ['.css', '.js', '.html'].includes(ext);
            if (shouldMinify) {
                copyFile(srcPath, destPath, true);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

// 1. Copy specific files (minify HTML/JS)
files.forEach(f => {
    const ext = path.extname(f).toLowerCase();
    const shouldMinify = ['.html', '.js'].includes(ext);
    copyFile(path.join(srcDir, f), path.join(distDir, f), shouldMinify);
});

// 2. Copy all PNGs (icons)
fs.readdirSync(srcDir).forEach(file => {
    if (file.endsWith('.png') && !files.includes(file)) {
        copyFile(path.join(srcDir, file), path.join(distDir, file));
    }
});

// 3. Copy directories (with minification for CSS/JS/HTML)
directories.forEach(dir => {
    copyDir(path.join(srcDir, dir), path.join(distDir, dir));
});

// 4. GENERATE CONFIG FILE (Secure Key Injection)
console.log('\n🔧 Generating Environment Config...');
const jsDistDir = path.join(distDir, 'js');
if (!fs.existsSync(jsDistDir)) {
    fs.mkdirSync(jsDistDir, { recursive: true });
}

const envKeys = (process.env.GEMINI_API_KEYS || '').replace(/['"]/g, '');
const configContent = `window.SHARED_CHATBOT_KEY='${envKeys}';`;

fs.writeFileSync(path.join(jsDistDir, 'env-config.js'), configContent);
console.log('✅ Generated dist/js/env-config.js with injected keys');

// Also create in SOURCE js folder for direct serving fallback
const jsSrcDir = path.join(srcDir, 'js');
if (fs.existsSync(jsSrcDir)) {
    try {
        fs.writeFileSync(path.join(jsSrcDir, 'env-config.js'), configContent);
        console.log('⚠️ Generated source js/env-config.js for fallback');
    } catch (e) {
        console.log('Could not write source config (optional step failed)');
    }
}

console.log(`\n✅ Build complete! Total saved by minification: ${(totalSaved / 1024).toFixed(1)} KB`);
