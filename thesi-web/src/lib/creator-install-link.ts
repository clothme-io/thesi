const CODE = /^[A-Za-z0-9_-]{43}$/;
const PRODUCT = /^[a-zA-Z0-9_-]{1,200}$/;
const CLOTHME = 'https://clothme.io';

export function clothmeProductLink(
  productId: string,
  code: string,
  env: Record<string, string | undefined>,
): string | undefined {
  if (!PRODUCT.test(productId) || !CODE.test(code)) return;
  return wrap(
    `clothme://product/${productId}?c=${code}`,
    `${CLOTHME}/product/${productId}?c=${code}`,
    env,
  );
}

export function clothmeInstallLink(
  code: string,
  env: Record<string, string | undefined>,
): string | undefined {
  if (!CODE.test(code)) return;
  return wrap(
    `clothme://creator-campaign/${code}`,
    `${CLOTHME}/creator-campaign/${code}`,
    env,
  );
}

// Airbridge long-link format and destination parameters:
// https://help.airbridge.io/en/guides/creating-tracking-links-on-the-editing-tools
export function creatorInstallLink(
  code: string,
  env: Record<string, string | undefined>,
  fallbackPath: 'r' | 'i' = 'r',
): string | undefined {
  void fallbackPath;
  return clothmeInstallLink(code, env);
}

function wrap(
  deeplink: string,
  desktop: string,
  env: Record<string, string | undefined>,
): string {
  if (env.CLOTHME_DEFERRED_LINKS_ENABLED !== 'true') return desktop;
  const app = env.CLOTHME_AIRBRIDGE_APP_NAME;
  const channel = env.CLOTHME_AIRBRIDGE_CHANNEL;
  if (
    !app ||
    !channel ||
    !/^[a-z0-9_-]{1,80}$/.test(app) ||
    !/^[A-Za-z0-9_.-]{1,80}$/.test(channel)
  )
    return desktop;
  const url = new URL(`https://abr.ge/@${app}/${channel}`);
  url.searchParams.set('deeplink_url', deeplink);
  url.searchParams.set('fallback_android', 'google-play');
  url.searchParams.set('fallback_ios', 'itunes-appstore');
  url.searchParams.set('fallback_desktop', desktop);
  return url.href;
}
