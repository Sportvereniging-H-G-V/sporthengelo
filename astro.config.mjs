// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  site: process.env.PUBLIC_SITE_URL || 'https://sporthengelo.nl',
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // Don't bundle Node.js built-ins - they're available in Cloudflare Workers runtime
      external: ['fs/promises', 'fs', 'path', 'url', 'util'],
      noExternal: [],
    },
  },
});
