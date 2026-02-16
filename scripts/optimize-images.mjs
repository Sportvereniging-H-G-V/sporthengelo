import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';

const imagesDir = join(process.cwd(), 'public', 'images');
const supportedFormats = ['.jpg', '.jpeg', '.png'];

async function optimizeImages() {
  try {
    const files = await readdir(imagesDir);
    const imageFiles = files.filter(file => {
      const ext = extname(file).toLowerCase();
      return supportedFormats.includes(ext);
    });

    console.log(`Gevonden ${imageFiles.length} afbeeldingen om te optimaliseren...\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of imageFiles) {
      const inputPath = join(imagesDir, file);
      const baseName = basename(file, extname(file));
      
      // Skip als het al een geoptimaliseerde versie is
      if (file.includes('.avif') || file.includes('.webp')) {
        continue;
      }

      // Logo en placeholder worden ook geoptimaliseerd

      try {
        const avifPath = join(imagesDir, `${baseName}.avif`);
        const webpPath = join(imagesDir, `${baseName}.webp`);

        // Check of de geoptimaliseerde versies al bestaan
        const avifExists = existsSync(avifPath);
        const webpExists = existsSync(webpPath);

        if (avifExists && webpExists) {
          console.log(`⏭️  Overgeslagen: ${file} (al geoptimaliseerd)`);
          skipped++;
          continue;
        }

        console.log(`🔄 Bezig met: ${file}...`);

        const image = sharp(inputPath);
        const metadata = await image.metadata();

        // Converteer naar AVIF (beste compressie, moderne browsers)
        if (!avifExists) {
          await image
            .clone()
            .avif({
              quality: 80,
              effort: 4,
            })
            .toFile(avifPath);
          
          const avifStats = await stat(avifPath);
          const originalStats = await stat(inputPath);
          const savings = ((1 - avifStats.size / originalStats.size) * 100).toFixed(1);
          console.log(`   ✅ AVIF: ${(avifStats.size / 1024).toFixed(1)}KB (${savings}% kleiner)`);
        }

        // Converteer naar WebP (fallback voor oudere browsers)
        if (!webpExists) {
          await image
            .clone()
            .webp({
              quality: 85,
              effort: 4,
            })
            .toFile(webpPath);
          
          const webpStats = await stat(webpPath);
          const originalStats = await stat(inputPath);
          const savings = ((1 - webpStats.size / originalStats.size) * 100).toFixed(1);
          console.log(`   ✅ WebP: ${(webpStats.size / 1024).toFixed(1)}KB (${savings}% kleiner)`);
        }

        processed++;
        console.log(`   ✨ Klaar: ${file}\n`);
      } catch (error) {
        console.error(`   ❌ Fout bij ${file}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Samenvatting:');
    console.log(`   ✅ Verwerkt: ${processed}`);
    console.log(`   ⏭️  Overgeslagen: ${skipped}`);
    console.log(`   ❌ Fouten: ${errors}`);
    console.log(`\n✨ Alle afbeeldingen zijn geoptimaliseerd!`);
  } catch (error) {
    console.error('Fout bij het optimaliseren:', error);
    process.exit(1);
  }
}

optimizeImages();

