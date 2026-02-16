/**
 * Genereert een geoptimaliseerde image srcset met AVIF en WebP
 * @param imagePath - Het pad naar de originele afbeelding (bijv. "/images/sport.jpg")
 * @returns Object met srcset en src voor gebruik in <picture> of <img>
 */
export function getOptimizedImage(imagePath: string) {
  // Extract base path without extension
  const pathWithoutExt = imagePath.replace(/\.(jpg|jpeg|png)$/i, '');
  
  return {
    // AVIF voor moderne browsers (beste compressie)
    avif: `${pathWithoutExt}.avif`,
    // WebP als laatste fallback (ondersteund door alle moderne browsers sinds 2014)
    webp: `${pathWithoutExt}.webp`,
  };
}

/**
 * Genereert een <picture> element met AVIF en WebP
 * Gebruik dit in Astro componenten
 */
export function getPictureSources(imagePath: string) {
  const optimized = getOptimizedImage(imagePath);
  
  return {
    avif: optimized.avif,
    webp: optimized.webp,
    fallback: optimized.webp, // WebP als laatste fallback (ondersteund door alle moderne browsers)
  };
}

