# brettlylecoaching.com

The new home of **Brett Lyle Coaching**, a career success coaching practice. Rebuilt from a Kajabi site as a fast static site on Cloudflare Pages. Hosting costs a fraction of the old subscription, and nothing the visitor touches is locked into a platform.

**Stack:** Astro 7 · TypeScript · Cloudflare Pages + Pages Functions · Formaloo API · Vitest · GitHub Actions

## Architecture

```
Browser ──▶ Cloudflare Pages (static HTML/CSS, ~0 JS except the form)
   │
   └─ POST /api/contact ──▶ Pages Function ──▶ Formaloo API ──▶ Brett's inbox
                            · verifies Turnstile    (responses + email alerts
                            · validates input        stay in the tool she
                            · honeypot + timing      already uses)
                              spam checks
                            · holds API secrets
```

- **Static first.** Every page is pre-rendered. The only client JS is the contact form and its Turnstile check.
- **Own the UI, keep the back office.** The form is hand-built to match the brand. It forwards to Formaloo, so Brett keeps the responses dashboard and notifications she already set up. Credentials live only in Cloudflare env vars.
- **Resilient field mapping.** Formaloo identifies fields by opaque slugs. The function looks the form up and matches by field title, so Brett can reword a label in Formaloo without a redeploy. If a field disappears, it fails loudly in logs and the visitor gets a direct email fallback. See [`src/lib/contact.ts`](src/lib/contact.ts) and its [tests](tests/contact.test.ts).
- **Layered spam defense.** Cloudflare Turnstile (invisible unless a visitor looks like a bot, verified server-side and failing closed), a honeypot field, a minimum fill time, and an edge rate limit on the endpoint. See [`src/lib/turnstile.ts`](src/lib/turnstile.ts).
- **No dead links after migration.** A build integration ([`integrations/redirects.mjs`](integrations/redirects.mjs)) generates Cloudflare `_redirects` that 301 every old Kajabi URL (store, offers, opt-ins, all 21 podcast episodes) to its new home.
- **Content as data.** Podcast episodes are a typed Astro content collection (Markdown + Zod schema). Offers, testimonials, and services live in [`src/data/site.ts`](src/data/site.ts).

## Project layout

```
src/
  pages/             index, coaching, about, contact, podcast/, 404
  components/        Header, Footer, ContactForm, OfferCards, Testimonials
  content/episodes/  one Markdown file per podcast episode
  data/site.ts       offers, testimonials, nav, help topics
  lib/contact.ts     validation, spam checks, Formaloo payload mapping (pure, tested)
functions/api/contact.ts   Cloudflare Pages Function
integrations/redirects.mjs Kajabi → new-site 301s, written at build time
scripts/import-podcast.mjs one-time podcast migration off Kajabi
```

## Develop

```bash
npm install
npm run dev        # Astro dev server (pages only)
npm test           # unit tests
npm run check      # astro check + function type-check
npm run build      # static build into ./dist
cp .dev.vars.example .dev.vars   # add Formaloo keys
npm run preview    # full stack locally: static site + /api/contact via wrangler
```

## Deploy (Cloudflare Pages)

1. Pages → Create project → connect this repo.
   Build command `npm run build`, output `dist`, Node 22.
2. Turnstile → Add widget for `brettlylecoaching.com` (and the `*.pages.dev` preview host), mode **Managed**.
3. Settings → Variables and secrets (Production):
   - `PUBLIC_TURNSTILE_SITE_KEY`: plain text (it's public and used at build time)
   - `TURNSTILE_SECRET_KEY`, `FORMALOO_API_KEY`, `FORMALOO_SECRET_KEY`: type **Secret**

   `FORMALOO_FORM_SLUG` is in `wrangler.toml`. Formaloo keys come from its API settings. Redeploy after adding.
4. Custom domains: add `www.brettlylecoaching.com`, then redirect the apex to `www`.
5. Rate limit (needs the domain on Cloudflare): Security → WAF → Rate limiting rules → create
   `URI Path equals /api/contact` **and** `Request Method equals POST`, by IP, 3 requests per 10 seconds → Block.
6. GitHub repo → Settings → Code security: enable **Secret scanning** and **Push protection**.

## Migration checklist (Kajabi access ends Oct 15, 2026)

- [ ] Run `npm run import:podcast -- --audio-base <R2 public URL>` and upload `./podcast-audio` to R2
- [ ] Export the Kajabi contact/newsletter list (CSV) and move it to an email tool
- [ ] Create Stripe Payment Links for the minicourse and coaching packages, then swap the `href`s in `src/data/site.ts`
- [ ] Download the Networking Foundations course videos and files
- [ ] Point DNS at Cloudflare Pages and confirm the redirects

## Credits

Design and engineering by [Frank MacBride](https://github.com/JustLikeFrank3). Content and photography © Brett Lyle Coaching.
