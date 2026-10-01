// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import kajabiRedirects from './integrations/redirects.mjs';

// Fully static output. Cloudflare Pages serves /dist and runs /functions
// (the contact-form endpoint) as Pages Functions, so no SSR adapter is needed.
export default defineConfig({
  site: 'https://www.brettlylecoaching.com',
  integrations: [sitemap(), kajabiRedirects()],
  trailingSlash: 'never',
  build: { format: 'file' },
});
