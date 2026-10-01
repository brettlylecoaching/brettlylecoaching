#!/usr/bin/env node
/**
 * One-time migration of the Emergent Leadership podcast off Kajabi.
 *
 *   npm run import:podcast -- --audio-base https://audio.brettlylecoaching.com
 *
 * 1. Reads the Kajabi RSS feed.
 * 2. Matches each <item> to an episode file by title.
 * 3. Downloads the MP3 into ./podcast-audio/<slug>.mp3 (gitignored).
 * 4. Rewrites the episode's frontmatter (audio URL, duration) and replaces the
 *    body with the real show notes from the feed.
 *
 * Then upload ./podcast-audio to the R2 bucket behind --audio-base, e.g.:
 *   for f in podcast-audio/*.mp3; do npx wrangler r2 object put "blc-podcast/$(basename $f)" --file "$f" --remote; done
 *
 * Must run before Kajabi access ends (Oct 15, 2026). Safe to re-run.
 */
import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const FEED = 'https://app.kajabi.com/podcasts/2147487514/feed';
const EP_DIR = new URL('../src/content/episodes/', import.meta.url);
const AUDIO_DIR = new URL('../podcast-audio/', import.meta.url);

const args = process.argv.slice(2);
const audioBase = (args[args.indexOf('--audio-base') + 1] ?? '').replace(/\/$/, '');
if (!args.includes('--audio-base') || !audioBase.startsWith('https://')) {
  console.error('Usage: npm run import:podcast -- --audio-base https://<public R2 or CDN URL>');
  process.exit(1);
}

const decode = (s = '') =>
  s.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]);
const norm = (s) => s.toLowerCase().replace(/\(with [^)]*\)/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** "01:02:03" | "62:03" | "3723" -> seconds */
const toSeconds = (d) => (d ? d.split(':').reduce((acc, n) => acc * 60 + Number(n), 0) : undefined);

/** Minimal HTML -> Markdown for show notes (paragraphs, breaks, links, bold/italic, lists). */
const toMarkdown = (html) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n').replace(/<\/?[uo]l[^>]*>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<\/?(strong|b)>/gi, '**').replace(/<\/?(em|i)>/gi, '_')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function setFrontmatter(src, key, value) {
  const line = `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`;
  const re = new RegExp(`^${key}:.*$`, 'm');
  return re.test(src) ? src.replace(re, line) : src.replace(/\n---\n/, `\n${line}\n---\n`);
}

const res = await fetch(FEED);
if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
const items = (await res.text()).split('<item>').slice(1).map((chunk) => {
  const xml = chunk.split('</item>')[0];
  return {
    title: tag(xml, 'title'),
    notes: tag(xml, 'content:encoded') || tag(xml, 'description'),
    duration: toSeconds(tag(xml, 'itunes:duration')),
    url: xml.match(/<enclosure[^>]*url="([^"]+)"/)?.[1],
  };
});
console.log(`Feed has ${items.length} episodes.`);

await mkdir(AUDIO_DIR, { recursive: true });
const files = (await readdir(EP_DIR)).filter((f) => f.endsWith('.md'));
let matched = 0;

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  let src = await readFile(new URL(file, EP_DIR), 'utf8');
  const title = src.match(/^title:\s*"(.*)"$/m)?.[1] ?? '';
  const item = items.find((i) => norm(i.title) === norm(title)) ?? items.find((i) => norm(i.title).startsWith(norm(title).slice(0, 30)));
  if (!item?.url) {
    console.warn(`  ✗ no feed match for "${title}"`);
    continue;
  }

  const dest = new URL(`${slug}.mp3`, AUDIO_DIR);
  const exists = await stat(dest).then((s) => s.size > 0, () => false);
  if (!exists) {
    const audio = await fetch(item.url);
    if (!audio.ok || !audio.body) throw new Error(`Download failed for ${slug}: ${audio.status}`);
    await pipeline(Readable.fromWeb(audio.body), createWriteStream(dest));
  }

  src = setFrontmatter(src, 'audio', `${audioBase}/${slug}.mp3`);
  if (item.duration) src = setFrontmatter(src, 'durationSeconds', item.duration);
  const notes = toMarkdown(item.notes ?? '');
  if (notes) src = src.replace(/(\n---\n)[\s\S]*$/, `$1\n${notes}\n`);

  await writeFile(new URL(file, EP_DIR), src);
  matched++;
  console.log(`  ✓ ${slug}${exists ? ' (audio already downloaded)' : ''}`);
}

console.log(`\nUpdated ${matched}/${files.length} episodes. Audio is in ./podcast-audio, ready to upload.`);
