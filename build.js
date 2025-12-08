/**
 * Build Script for Bunkit
 * Minifies and obfuscates JavaScript for production
 * 
 * Usage:
 *   node build.js                    # Copy only
 *   node build.js --minify           # Minify JS
 *   node build.js --obfuscate        # Obfuscate JS
 *   node build.js --minify --obfuscate  # Both (production)
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const shouldMinify = args.includes('--minify');
const shouldObfuscate = args.includes('--obfuscate');

// Directories
const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

// Files to process
const filesToCopy = [
    'index.html',
    'offline.html',
    'sw.js',
    'manifest.json',
    'netlify.toml',
    // Icons
    'icon-48x48.png',
    'icon-72x72.png',
    'icon-96x96.png',
    'icon-128x128.png',
    'icon-144x144.png',
    'icon-152x152.png',
    'icon-192x192.png',
    'icon-256x256.png',
    'icon-384x384.png',
    'icon-512x512.png',
    'badge-icon.png',
    'splash-icon.png',
    'notification-icon.png',
    'donate-qr.png'
];

// Directories to copy
const dirsToCopy = [
    'netlify',
    '.well-known'
];

async function build() {
    console.log('🔨 Building Bunkit...\n');
    console.log(`Options: ${shouldMinify ? '✓ Minify' : '✗ Minify'} | ${shouldObfuscate ? '✓ Obfuscate' : '✗ Obfuscate'}\n`);

    // Create dist directory
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    // Load dependencies if needed
    let terser, JavaScriptObfuscator, cheerio;

    if (shouldMinify) {
        try {
            terser = require('terser');
        } catch (e) {
            console.error('❌ terser not installed. Run: npm install');
            process.exit(1);
        }
    }

    if (shouldObfuscate) {
        try {
            JavaScriptObfuscator = require('javascript-obfuscator');
        } catch (e) {
            console.error('❌ javascript-obfuscator not installed. Run: npm install');
            process.exit(1);
        }
    }

    try {
        cheerio = require('cheerio');
    } catch (e) {
        console.error('❌ cheerio not installed. Run: npm install');
        process.exit(1);
    }

    // Process HTML files with inline scripts
    for (const file of filesToCopy) {
        const srcPath = path.join(srcDir, file);
        const distPath = path.join(distDir, file);

        if (!fs.existsSync(srcPath)) {
            console.log(`⚠️  Skipping ${file} (not found)`);
            continue;
        }

        if (file.endsWith('.html') && (shouldMinify || shouldObfuscate)) {
            console.log(`📄 Processing ${file}...`);
            let html = fs.readFileSync(srcPath, 'utf8');
            const $ = cheerio.load(html, { decodeEntities: false });

            // Process each script tag
            const scriptTags = $('script:not([src])');
            let processedCount = 0;

            for (let i = 0; i < scriptTags.length; i++) {
                const script = $(scriptTags[i]);
                let code = script.html();

                if (!code || code.trim().length < 100) continue;

                try {
                    // Minify
                    if (shouldMinify) {
                        const minified = await terser.minify(code, {
                            compress: {
                                dead_code: true,
                                drop_console: false, // Keep console for debugging
                                drop_debugger: true
                            },
                            mangle: true
                        });
                        if (minified.code) {
                            code = minified.code;
                        }
                    }

                    // Obfuscate
                    if (shouldObfuscate) {
                        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
                            compact: true,
                            controlFlowFlattening: false, // Faster but less obfuscated
                            deadCodeInjection: false,
                            stringArray: true,
                            stringArrayThreshold: 0.5,
                            splitStrings: true,
                            splitStringsChunkLength: 10,
                            rotateStringArray: true,
                            identifierNamesGenerator: 'hexadecimal',
                            renameGlobals: false, // Don't rename globals to avoid breaking things
                            selfDefending: false
                        });
                        code = obfuscated.getObfuscatedCode();
                    }

                    script.html(code);
                    processedCount++;
                } catch (err) {
                    console.error(`   ⚠️  Error processing script ${i + 1}: ${err.message}`);
                }
            }

            fs.writeFileSync(distPath, $.html());
            console.log(`   ✓ Processed ${processedCount} script blocks`);
        } else if (file.endsWith('.js') && (shouldMinify || shouldObfuscate)) {
            console.log(`📜 Processing ${file}...`);
            let code = fs.readFileSync(srcPath, 'utf8');

            try {
                if (shouldMinify) {
                    const minified = await terser.minify(code);
                    if (minified.code) code = minified.code;
                }

                if (shouldObfuscate) {
                    const obfuscated = JavaScriptObfuscator.obfuscate(code, {
                        compact: true,
                        stringArray: true,
                        rotateStringArray: true
                    });
                    code = obfuscated.getObfuscatedCode();
                }

                fs.writeFileSync(distPath, code);
                console.log(`   ✓ Done`);
            } catch (err) {
                console.error(`   ⚠️  Error: ${err.message}`);
                fs.copyFileSync(srcPath, distPath);
            }
        } else {
            // Just copy the file
            fs.copyFileSync(srcPath, distPath);
            console.log(`📋 Copied ${file}`);
        }
    }

    // Copy directories
    for (const dir of dirsToCopy) {
        const srcPath = path.join(srcDir, dir);
        const distPath = path.join(distDir, dir);

        if (fs.existsSync(srcPath)) {
            copyDirectory(srcPath, distPath);
            console.log(`📁 Copied ${dir}/`);
        }
    }

    console.log('\n✅ Build complete! Output in: dist/');
    console.log('\nTo deploy: npm run deploy');
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

build().catch(console.error);
