import { defineCollection, z } from 'astro:content';

const sportsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    image: z.string(),
    summary: z.string(),
    category: z.string(),
    external_url: z.string().optional(),
  }),
});

const adaptiveCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    image: z.string(),
    summary: z.string(),
    category: z.string(),
    external_url: z.string().optional(),
  }),
});

export const collections = {
  sports: sportsCollection,
  adaptive: adaptiveCollection,
};
