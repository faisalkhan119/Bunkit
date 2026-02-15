const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

async function compressPNGs() {
    const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.png'));

    console.log(`Found ${files.length} PNG files to compress:\n`);

    for (const file of files) {
        const filePath = path.join(rootDir, file);
        const originalSize = fs.statSync(filePath).size;

        try {
            const buffer = await sharp(filePath)
                .png({
                    quality: 80,
                    compressionLevel: 9,
                    palette: true  // Use palette-based quantization for smaller files
                })
                .toBuffer();

            // Only write if actually smaller
            if (buffer.length < originalSize) {
                fs.writeFileSync(filePath, buffer);
                const savedKB = ((originalSize - buffer.length) / 1024).toFixed(1);
                const pct = ((1 - buffer.length / originalSize) * 100).toFixed(0);
                console.log(`✅ ${file}: ${(originalSize / 1024).toFixed(1)} KB → ${(buffer.length / 1024).toFixed(1)} KB (-${savedKB} KB, -${pct}%)`);
            } else {
                console.log(`⏩ ${file}: Already optimal (${(originalSize / 1024).toFixed(1)} KB)`);
            }
        } catch (e) {
            console.error(`❌ ${file}: ${e.message}`);
        }
    }

    console.log('\n✅ Image compression complete!');
}

compressPNGs();
