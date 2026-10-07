import { creatorShareUrl } from './creator-share-url';

const code = 'a'.repeat(43);
const productId = 'p1';
const env = (values: Record<string, unknown> = {}) => ({
  get: (key: string) => values[key],
});

describe('creator share URL', () => {
  it('uses the ClothME product URI with the creator attached', () => {
    expect(creatorShareUrl({ publicCode: code, productId }, env())).toBe(
      `https://clothme.io/product/${productId}?c=${code}`,
    );
  });

  it('uses the ClothME campaign URI for app install links', () => {
    expect(creatorShareUrl({ publicCode: code, install: true }, env())).toBe(
      `https://clothme.io/creator-campaign/${code}`,
    );
    expect(
      creatorShareUrl(
        { publicCode: code, install: true, installApp: 'vendor' },
        env(),
      ),
    ).toBe(`https://clothme.io/vendor-campaign/${code}`);
  });

  it('wraps the product URI in Airbridge when deferred links are configured', () => {
    const url = new URL(
      creatorShareUrl(
        { publicCode: code, productId },
        env({
          CLOTHME_DEFERRED_LINKS_ENABLED: true,
          CLOTHME_AIRBRIDGE_APP_NAME: 'clothme',
          CLOTHME_AIRBRIDGE_CHANNEL: 'creator',
        }),
      ),
    );
    expect(url.origin).toBe('https://abr.ge');
    expect(url.pathname).toBe('/@clothme/creator');
    expect(url.searchParams.get('deeplink_url')).toBe(
      `clothme://product/${productId}?c=${code}`,
    );
    expect(url.searchParams.get('fallback_desktop')).toBe(
      `https://clothme.io/product/${productId}?c=${code}`,
    );
  });
});
