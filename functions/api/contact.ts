/**
 * POST /api/contact (Cloudflare Pages Function)
 *
 * Validates the site's own contact form and forwards it to Formaloo, so
 * submissions land in Brett's existing Formaloo responses and trigger the
 * email notification configured there. API credentials never reach the browser.
 *
 * Accepts JSON (fetch from the page) or a classic form post (no-JS fallback).
 */
import { buildFormalooPayload, looksLikeSpam, validateContact, type FormalooField } from '../../src/lib/contact';
import { helpTopics } from '../../src/data/site';
import { verifyTurnstile } from '../../src/lib/turnstile';

interface Env {
  FORMALOO_API_KEY: string;
  FORMALOO_SECRET_KEY: string;
  FORMALOO_FORM_SLUG: string;
  /** Optional until Turnstile is set up; once set, every submission must pass. */
  TURNSTILE_SECRET_KEY?: string;
}

const API = 'https://api.formaloo.me/v3.0';

async function getToken(env: Env): Promise<string> {
  const res = await fetch(`${API}/oauth2/authorization-token/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${env.FORMALOO_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Formaloo auth failed: ${res.status}`);
  const data = (await res.json()) as { authorization_token?: string };
  if (!data.authorization_token) throw new Error('Formaloo auth returned no token');
  return data.authorization_token;
}

// Field definitions rarely change; cache them per isolate for 10 minutes.
let fieldCache: { at: number; fields: FormalooField[] } | undefined;

async function getFields(env: Env, headers: HeadersInit): Promise<FormalooField[]> {
  if (fieldCache && Date.now() - fieldCache.at < 10 * 60_000) return fieldCache.fields;
  const res = await fetch(`${API}/forms/${env.FORMALOO_FORM_SLUG}/`, { headers });
  if (!res.ok) throw new Error(`Formaloo form lookup failed: ${res.status}`);
  const data = (await res.json()) as { data?: { form?: { fields_list?: FormalooField[] } } };
  const fields = data.data?.form?.fields_list;
  if (!Array.isArray(fields)) throw new Error('Formaloo form response had no fields_list');
  fieldCache = { at: Date.now(), fields };
  return fields;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return (await request.json()) as Record<string, unknown>;
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    const all = form.getAll(key).map(String);
    out[key] = key === 'topics' ? all : all[0];
  }
  return out;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const reply = (status: number, body: Record<string, unknown>) =>
    wantsJson
      ? Response.json(body, { status })
      : Response.redirect(new URL(status < 300 ? '/contact?sent=1' : '/contact?error=1', request.url).toString(), 303);

  let raw: Record<string, unknown>;
  try {
    raw = await readBody(request);
  } catch {
    return reply(400, { ok: false, error: 'Unreadable request.' });
  }

  // Quietly "succeed" for bots so they don't retry.
  if (looksLikeSpam(raw)) return reply(200, { ok: true });

  if (env.TURNSTILE_SECRET_KEY) {
    const check = await verifyTurnstile(raw['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
    if (!check.success) {
      console.warn('[contact] turnstile rejected', check['error-codes']);
      return reply(403, { ok: false, error: 'We couldn’t confirm you’re human. Please refresh the page and try again.' });
    }
  } else {
    console.warn('[contact] TURNSTILE_SECRET_KEY not set; bot check skipped');
  }

  const result = validateContact(raw, helpTopics);
  if (!result.ok) return reply(422, { ok: false, errors: result.errors });

  try {
    const token = await getToken(env);
    const headers = { 'X-Api-Key': env.FORMALOO_API_KEY, Authorization: `JWT ${token}`, 'Content-Type': 'application/json' };
    const fields = await getFields(env, headers);
    const payload = buildFormalooPayload(result.value, fields);

    const res = await fetch(`${API}/form-displays/slug/${env.FORMALOO_FORM_SLUG}/submit/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Formaloo submit failed: ${res.status} ${await res.text()}`);
    return reply(200, { ok: true });
  } catch (err) {
    console.error('[contact]', err);
    fieldCache = undefined;
    return reply(502, {
      ok: false,
      error: 'Something went wrong on our end. Please email brettlylecoaching@gmail.com directly.',
    });
  }
};
