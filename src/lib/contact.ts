/**
 * Contact-form domain logic, shared by the Pages Function and the unit tests.
 * Pure functions only: no fetch, no env access.
 */

export type ContactInput = {
  name: string;
  email: string;
  phone?: string;
  topics: string[];
  message: string;
};

export type ValidationResult =
  | { ok: true; value: ContactInput }
  | { ok: false; errors: Partial<Record<keyof ContactInput, string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 120, email: 254, phone: 32, message: 5000 } as const;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function validateContact(raw: Record<string, unknown>, allowedTopics: readonly string[]): ValidationResult {
  const name = str(raw.name);
  const email = str(raw.email);
  const phone = str(raw.phone);
  const message = str(raw.message);
  const rawTopics = Array.isArray(raw.topics) ? raw.topics : raw.topics ? [raw.topics] : [];
  const topics = [...new Set(rawTopics.map(str).filter((t) => allowedTopics.includes(t)))];

  const errors: Partial<Record<keyof ContactInput, string>> = {};
  if (!name) errors.name = 'Please share your name.';
  else if (name.length > LIMITS.name) errors.name = 'That name is a little long.';
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) errors.email = 'Please enter a valid email address.';
  if (phone && (phone.length > LIMITS.phone || !/^[+\d\s().-]{7,}$/.test(phone))) errors.phone = 'Please check the phone number.';
  if (!message) errors.message = 'Tell Brett a little about what you’re looking for.';
  else if (message.length > LIMITS.message) errors.message = 'Please keep it under 5,000 characters.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email, phone: phone || undefined, topics, message } };
}

/** Honeypot + minimum fill time. Bots fill hidden fields and submit instantly. */
export function looksLikeSpam(raw: Record<string, unknown>, now = Date.now()): boolean {
  if (str(raw.company)) return true;
  const started = Number(raw.startedAt);
  return Number.isFinite(started) && now - started < 2500;
}

// ---- Formaloo mapping -------------------------------------------------------

export type FormalooField = {
  slug: string;
  title: string;
  type: string;
  choice_items?: { slug: string; title: string }[];
};

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Formaloo identifies fields by opaque slugs. Rather than hard-coding them,
 * we match on field titles, so Brett can reword a label in Formaloo without
 * a redeploy as long as the key word survives.
 */
const MATCHERS: Record<keyof ContactInput, (f: FormalooField) => boolean> = {
  name: (f) => /\bname\b/.test(norm(f.title)),
  email: (f) => f.type === 'email' || /\bemail\b/.test(norm(f.title)),
  phone: (f) => f.type === 'phone' || /\bphone\b/.test(norm(f.title)),
  topics: (f) => ['multiple_select', 'choice', 'dropdown'].includes(f.type) && /help/.test(norm(f.title)),
  message: (f) => /\bmessage\b/.test(norm(f.title)),
};

export function buildFormalooPayload(input: ContactInput, fields: FormalooField[]): Record<string, unknown> {
  const find = (key: keyof ContactInput) => fields.find(MATCHERS[key]);
  const body: Record<string, unknown> = {};

  for (const key of ['name', 'email', 'phone', 'message'] as const) {
    const value = input[key];
    if (!value) continue;
    const field = find(key);
    if (!field) throw new Error(`Formaloo form has no field matching "${key}"`);
    body[field.slug] = value;
  }

  if (input.topics.length) {
    const field = find('topics');
    if (!field) throw new Error('Formaloo form has no "help with" choice field');
    const slugs = input.topics
      .map((t) => field.choice_items?.find((c) => norm(c.title) === norm(t))?.slug)
      .filter((s): s is string => Boolean(s));
    if (slugs.length) body[field.slug] = field.type === 'multiple_select' ? slugs : slugs[0];
  }

  return body;
}
