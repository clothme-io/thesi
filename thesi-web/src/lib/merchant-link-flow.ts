const KEY = 'thesi_merchant_link_intent';
const CODE = /^[A-Za-z0-9_-]{43}$/;
export function readMerchantIntent(): string {
  const incoming = new URLSearchParams(window.location.hash.slice(1)).get('code');
  if (incoming) {
    window.history.replaceState(null, '', window.location.pathname);
    if (!CODE.test(incoming)) throw new Error('Invalid connection request. Start again in Merchant Hub.');
    sessionStorage.setItem(KEY, JSON.stringify({ code: incoming, expiresAt: Date.now() + 10 * 60 * 1000 }));
  }
  const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null') as { code?: string; expiresAt?: number } | null;
  if (!saved?.code || !CODE.test(saved.code) || !saved.expiresAt || saved.expiresAt <= Date.now()) {
    sessionStorage.removeItem(KEY);
    throw new Error('Connection request expired or is missing. Start again in Merchant Hub.');
  }
  return saved.code;
}
export function clearMerchantIntent() { sessionStorage.removeItem(KEY); }
export function merchantReturnUrl(value: string): string {
  const url = new URL(value);
  const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/app/settings/integrations/thesi') throw new Error('Invalid Merchant return address');
  return url.toString();
}
