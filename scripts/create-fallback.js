// Fallback generation
import sharp from 'sharp';
import path from 'path';

const outputPath = path.join(process.cwd(), 'public', 'images', 'fallback.webp');

async function createFallback() {
    try {
        await sharp({
            create: {
                width: 800,
                height: 800,
                channels: 4,
                background: { r: 242, g: 240, b: 233, alpha: 1 } // #F2F0E9 (Cream background)
            }
        })
            .webp({ quality: 80 })
            .toFile(outputPath);

        console.log(`✅ Created universal fallback at: ${outputPath}`);
    } catch (error) {
        console.error(`❌ Error creating fallback:`, error);
    }
}

createFallback();
