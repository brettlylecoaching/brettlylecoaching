import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Writes Cloudflare Pages `_redirects` after the build, so every old Kajabi URL
 * (shared links, Google results, podcast apps) lands somewhere useful.
 * Episode rules come from each episode's `kajabiId` frontmatter.
 */
export default function kajabiRedirects() {
  return {
    name: 'kajabi-redirects',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const epDir = new URL('../src/content/episodes/', import.meta.url);
        const files = (await readdir(epDir)).filter((f) => f.endsWith('.md'));
        const episodeRules = await Promise.all(
          files.map(async (f) => {
            const src = await readFile(new URL(f, epDir), 'utf8');
            const id = src.match(/^kajabiId:\s*"?(\d+)"?/m)?.[1];
            if (!id) throw new Error(`${f} is missing kajabiId`);
            return `/podcasts/emergent-leadership/episodes/${id} /podcast/${f.replace(/\.md$/, '')} 301`;
          }),
        );
        const rules = [
          '/store /coaching 301',
          '/offers/* /coaching 301',
          '/resource_redirect/* /coaching 301',
          '/joinus /contact 301',
          '/thank-you /contact 301',
          '/concierge-career-coaching-membership-opt-in /contact 301',
          '/opt-in-949b0337-ff64-49d1-9cef-4e11daeee396 /contact 301',
          '/login / 302',
          '/podcasts/emergent-leadership /podcast 301',
          ...episodeRules.sort(),
        ];
        await writeFile(new URL('_redirects', dir), rules.join('\n') + '\n');
        logger.info(`wrote ${rules.length} redirect rules to ${fileURLToPath(new URL('_redirects', dir))}`);
      },
    },
  };
}
