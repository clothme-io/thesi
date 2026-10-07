const CODE = /^[A-Za-z0-9_-]{43}$/;
const PRODUCT = /^[a-zA-Z0-9_-]{1,200}$/;
const CLOTHME = 'https://clothme.io';

export function creatorShareUrl(
  input: {
    publicCode: string;
    productId?: string | null;
    install?: boolean;
    installApp?: 'customer' | 'vendor' | null;
  },
  env: { get(key: string): unknown },
): string {
  const code = input.publicCode;
  if (!CODE.test(code)) throw new Error('Invalid creator share code');
  const vendorInstall = input.install && input.installApp === 'vendor';
  const campaignPath = vendorInstall
    ? `vendor-campaign/${code}`
    : `creator-campaign/${code}`;
  const deeplink = input.install
    ? `clothme://${campaignPath}`
    : input.productId && PRODUCT.test(input.productId)
      ? `clothme://product/${input.productId}?c=${code}`
      : `clothme://${campaignPath}`;
  const desktop = input.install
    ? `${CLOTHME}/${campaignPath}`
    : input.productId && PRODUCT.test(input.productId)
      ? `${CLOTHME}/product/${input.productId}?c=${code}`
      : `${CLOTHME}/${campaignPath}`;
  return airbridgeUrl(deeplink, desktop, env) ?? desktop;
}

function flag(env: { get(key: string): unknown }, key: string) {
  const value = env.get(key);
  return value === true || value === 'true';
}

function airbridgeUrl(
  deeplink: string,
  desktop: string,
  env: { get(key: string): unknown },
) {
  if (!flag(env, 'CLOTHME_DEFERRED_LINKS_ENABLED')) return;
  const app = String(env.get('CLOTHME_AIRBRIDGE_APP_NAME') ?? '');
  const channel = String(env.get('CLOTHME_AIRBRIDGE_CHANNEL') ?? '');
  if (
    !/^[a-z0-9_-]{1,80}$/.test(app) ||
    !/^[A-Za-z0-9_.-]{1,80}$/.test(channel)
  )
    return;
  const url = new URL(`https://abr.ge/@${app}/${channel}`);
  url.searchParams.set('deeplink_url', deeplink);
  url.searchParams.set('fallback_android', 'google-play');
  url.searchParams.set('fallback_ios', 'itunes-appstore');
  url.searchParams.set('fallback_desktop', desktop);
  return url.href;
}
