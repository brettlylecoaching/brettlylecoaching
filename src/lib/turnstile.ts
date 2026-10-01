/**
 * Server-side Cloudflare Turnstile verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = { success: boolean; 'error-codes'?: string[]; hostname?: string };

export async function verifyTurnstile(
  token: unknown,
  secret: string,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return { success: false, 'error-codes': ['missing-input-response'] };
  }
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetchImpl(SITEVERIFY, { method: 'POST', body });
  if (!res.ok) return { success: false, 'error-codes': [`siteverify-http-${res.status}`] };
  return (await res.json()) as TurnstileResult;
}
