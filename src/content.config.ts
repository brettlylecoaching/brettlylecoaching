import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const episodes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/episodes' }),
  schema: z.object({
    title: z.string(),
    guest: z.string().optional(),
    summary: z.string(),
    published: z.coerce.date(),
    /** Kajabi episode id — used to 301 old URLs to the new ones. */
    kajabiId: z.string(),
    /** Absolute URL of the re-hosted audio file (filled in by `npm run import:podcast`). */
    audio: z.url().optional(),
    durationSeconds: z.number().int().positive().optional(),
  }),
});

export const collections = { episodes };
