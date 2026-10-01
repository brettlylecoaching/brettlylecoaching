import { describe, expect, it } from 'vitest';
import { buildFormalooPayload, looksLikeSpam, validateContact, type FormalooField } from '../src/lib/contact';
import { helpTopics } from '../src/data/site';

const good = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Changing careers.', topics: ['Networking'] };

describe('validateContact', () => {
  it('accepts a complete submission and trims values', () => {
    const r = validateContact({ ...good, name: '  Ada  ' }, helpTopics);
    expect(r).toEqual({ ok: true, value: { name: 'Ada', email: 'ada@example.com', phone: undefined, message: 'Changing careers.', topics: ['Networking'] } });
  });

  it('reports every missing required field', () => {
    const r = validateContact({}, helpTopics);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'message', 'name']);
  });

  it('drops topics that are not on the allow-list and de-duplicates', () => {
    const r = validateContact({ ...good, topics: ['Networking', 'Networking', '<script>'] }, helpTopics);
    expect(r.ok && r.value.topics).toEqual(['Networking']);
  });

  it('accepts a single topic string from a no-JS form post', () => {
    const r = validateContact({ ...good, topics: 'Interview prep' }, helpTopics);
    expect(r.ok && r.value.topics).toEqual(['Interview prep']);
  });

  it('rejects malformed email and phone', () => {
    const r = validateContact({ ...good, email: 'nope', phone: 'call me' }, helpTopics);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toMatchObject({ email: expect.any(String), phone: expect.any(String) });
  });
});

describe('looksLikeSpam', () => {
  it('flags a filled honeypot', () => expect(looksLikeSpam({ company: 'Acme' })).toBe(true));
  it('flags instant submissions', () => expect(looksLikeSpam({ startedAt: 1000 }, 2000)).toBe(true));
  it('lets humans through', () => expect(looksLikeSpam({ startedAt: 1000 }, 60_000)).toBe(false));
});

describe('buildFormalooPayload', () => {
  // Mirrors the live form: titles as Brett set them in Formaloo, opaque slugs.
  const fields: FormalooField[] = [
    { slug: 'f1', title: 'Full name', type: 'short_text' },
    { slug: 'f2', title: 'Email address', type: 'email' },
    { slug: 'f3', title: 'Your message', type: 'long_text' },
    { slug: 'f4', title: 'Status', type: 'dropdown', choice_items: [{ slug: 's1', title: 'New' }] },
    { slug: 'f5', title: 'Phone (optional)', type: 'phone' },
    {
      slug: 'f6',
      title: 'What would you like help with?',
      type: 'multiple_select',
      choice_items: helpTopics.map((t, i) => ({ slug: `c${i}`, title: t })),
    },
  ];

  it('maps inputs to field slugs and topics to choice slugs', () => {
    const payload = buildFormalooPayload(
      { name: 'Ada', email: 'ada@example.com', phone: '+1 404 555 0100', message: 'Hi', topics: ['Networking', 'Interview prep'] },
      fields,
    );
    expect(payload).toEqual({ f1: 'Ada', f2: 'ada@example.com', f3: 'Hi', f5: '+1 404 555 0100', f6: ['c2', 'c3'] });
  });

  it('never writes to the admin-only Status field', () => {
    const payload = buildFormalooPayload({ name: 'Ada', email: 'a@b.co', message: 'Hi', topics: [] }, fields);
    expect(payload).not.toHaveProperty('f4');
  });

  it('fails loudly if a required field is renamed beyond recognition', () => {
    expect(() => buildFormalooPayload({ name: 'Ada', email: 'a@b.co', message: 'Hi', topics: [] }, fields.filter((f) => f.slug !== 'f3'))).toThrow(/message/);
  });
});
