import { describe, expect, it, vi } from 'vitest';
import { SITEVERIFY, verifyTurnstile } from '../src/lib/turnstile';

const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe('verifyTurnstile', () => {
  it('rejects a missing token without calling Cloudflare', async () => {
    const f = ok({ success: true });
    expect(await verifyTurnstile(undefined, 'secret', null, f)).toEqual({ success: false, 'error-codes': ['missing-input-response'] });
    expect(f).not.toHaveBeenCalled();
  });

  it('posts secret, token and client IP to siteverify', async () => {
    const f = ok({ success: true });
    const r = await verifyTurnstile('tok', 'secret', '203.0.113.7', f);
    expect(r.success).toBe(true);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(SITEVERIFY);
    const body = init.body as FormData;
    expect([body.get('secret'), body.get('response'), body.get('remoteip')]).toEqual(['secret', 'tok', '203.0.113.7']);
  });

  it('passes through Cloudflare rejections', async () => {
    const r = await verifyTurnstile('tok', 'secret', null, ok({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    expect(r).toEqual({ success: false, 'error-codes': ['timeout-or-duplicate'] });
  });

  it('fails closed when siteverify is down', async () => {
    const f = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    expect((await verifyTurnstile('tok', 'secret', null, f)).success).toBe(false);
  });
});
