import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputDir = path.join(process.cwd(), 'public', 'mockups');
const outputDir = path.join(process.cwd(), 'public', 'images', 'products');

// Create output dir if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Map the generated files to clean final names
const fileMapping = {
    'wellspring_bottle_1772517164599.png': 'wellspring_bottle.webp',
    'bestseller_quencher.png': 'bestseller_quencher.webp',
    'iceflow_flip_straw_1772517278796.png': 'iceflow_flip_straw.webp',
    'classic_flask_1772517294507.png': 'classic_flask.webp',
    'food_jar_1772517309159.png': 'food_jar.webp'
};

async function optimizeImages() {
    console.log('Starting image optimization...');

    for (const [inputFile, outputFile] of Object.entries(fileMapping)) {
        const inputPath = path.join(inputDir, inputFile);
        const outputPath = path.join(outputDir, outputFile);

        if (fs.existsSync(inputPath)) {
            try {
                await sharp(inputPath)
                    .resize(800, 800, {
                        fit: 'contain',
                        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent padding
                    })
                    .webp({ quality: 75 })
                    .toFile(outputPath);

                console.log(`✅ Optimized: ${inputFile} -> ${outputFile}`);
            } catch (error) {
                console.error(`❌ Error optimizing ${inputFile}:`, error);
            }
        } else {
            console.warn(`⚠️ Warning: Input file not found: ${inputPath}`);
        }
    }

    console.log('Optimization complete!');
}

optimizeImages();
