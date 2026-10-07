import {describe,it,expect} from 'vitest';
import {clothmeInstallLink,clothmeProductLink,creatorInstallLink} from './creator-install-link';
describe('ClothME creator share URLs',()=>{
  const code='a'.repeat(43);
  const productId='p1';
  const env={CLOTHME_DEFERRED_LINKS_ENABLED:'true',CLOTHME_AIRBRIDGE_APP_NAME:'clothme',CLOTHME_AIRBRIDGE_CHANNEL:'creator'};
  it('attaches the creator to the product URI',()=>{
    expect(clothmeProductLink(productId,code,{})).toBe(`https://clothme.io/product/${productId}?c=${code}`);
    expect(clothmeInstallLink(code,{})).toBe(`https://clothme.io/creator-campaign/${code}`);
  });
  it('is disabled for malformed destinations',()=>{
    expect(clothmeProductLink('../other',code,env)).toBeUndefined();
    expect(clothmeInstallLink('../invalid',env)).toBeUndefined();
  });
  it('wraps the product URI in Airbridge when deferred links are configured',()=>{
    const url=new URL(clothmeProductLink(productId,code,env)!);
    expect(url.origin).toBe('https://abr.ge');expect(url.pathname).toBe('/@clothme/creator');
    expect(url.searchParams.get('deeplink_url')).toBe(`clothme://product/${productId}?c=${code}`);
    expect(url.searchParams.get('fallback_desktop')).toBe(`https://clothme.io/product/${productId}?c=${code}`);
  });
  it('keeps install shares on ClothME, not Thesi',()=>{
    const url=new URL(creatorInstallLink(code,env,'i')!);
    expect(url.searchParams.get('deeplink_url')).toBe(`clothme://creator-campaign/${code}`);
    expect(url.searchParams.get('fallback_desktop')).toBe(`https://clothme.io/creator-campaign/${code}`);
  });
});
