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

console.log('📦 Starting dependency-free build...');

// Helper: Copy file
function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✓ Copied ${path.basename(src)}`);
    } else {
        console.log(`⚠️ Missing ${path.basename(src)}`);
    }
}

// Helper: Copy directory recursive
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
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 1. Copy specific files
files.forEach(f => copyFile(path.join(srcDir, f), path.join(distDir, f)));

// 2. Copy all PNGs (icons)
fs.readdirSync(srcDir).forEach(file => {
    if (file.endsWith('.png') && !files.includes(file)) {
        copyFile(path.join(srcDir, file), path.join(distDir, file));
    }
});

// 3. Copy directories
directories.forEach(dir => {
    copyDir(path.join(srcDir, dir), path.join(distDir, dir));
});

console.log('✅ Build complete (dist folder populated)');
