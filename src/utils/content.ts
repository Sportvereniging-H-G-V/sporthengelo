import { getCollection } from 'astro:content';

/**
 * Get all sports, optionally filtered by category
 */
export async function getSports(category?: 'regulier' | 'aangepast') {
  const sports = await getCollection('sports');
  const adaptive = await getCollection('adaptive');
  
  let allSports = [
    ...sports.map((sport) => ({
      ...sport,
      category: 'regulier' as const,
    })),
    ...adaptive.map((sport) => ({
      ...sport,
      category: 'aangepast' as const,
    })),
  ];

  if (category) {
    allSports = allSports.filter((sport) => sport.category === category);
  }

  // Sort alphabetically by title
  return allSports.sort((a, b) => a.data.title.localeCompare(b.data.title, 'nl'));
}

/**
 * Get a single sport by slug
 */
export async function getSportBySlug(slug: string) {
  const sports = await getCollection('sports');
  const adaptive = await getCollection('adaptive');
  
  const allEntries = [
    ...sports.map((sport) => ({ ...sport, category: 'regulier' as const })),
    ...adaptive.map((sport) => ({ ...sport, category: 'aangepast' as const })),
  ];
  
  return allEntries.find((sport) => sport.slug === slug) || null;
}
