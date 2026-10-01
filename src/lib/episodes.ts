import type { CollectionEntry } from 'astro:content';

export const episodeHref = (ep: CollectionEntry<'episodes'>) => `/podcast/${ep.id}`;

export const byNewest = (a: CollectionEntry<'episodes'>, b: CollectionEntry<'episodes'>) =>
  b.data.published.getTime() - a.data.published.getTime() || a.data.title.localeCompare(b.data.title);

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
