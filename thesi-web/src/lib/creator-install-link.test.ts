import {describe,it,expect} from 'vitest';
import {creatorInstallLink} from './creator-install-link';
describe('optional deferred install destination',()=>{
  const code='a'.repeat(43);
  const env={CLOTHME_DEFERRED_LINKS_ENABLED:'true',CLOTHME_AIRBRIDGE_APP_NAME:'local-fixture',CLOTHME_AIRBRIDGE_CHANNEL:'creator'};
  it('is disabled without explicit complete configuration',()=>{
    expect(creatorInstallLink(code,{})).toBeUndefined();
    expect(creatorInstallLink(code,{CLOTHME_DEFERRED_LINKS_ENABLED:'true'})).toBeUndefined();
    expect(creatorInstallLink(code,{...env,CLOTHME_AIRBRIDGE_APP_NAME:'../other?x=y'})).toBeUndefined();
    expect(creatorInstallLink('../invalid',env)).toBeUndefined();
  });
  it('preserves only the durable public code through the documented provider format',()=>{
    const url=new URL(creatorInstallLink(code,env)!);
    expect(url.origin).toBe('https://abr.ge');expect(url.pathname).toBe('/@local-fixture/creator');
    expect(url.searchParams.get('deeplink_url')).toBe(`clothme://creator-campaign/${code}`);
    expect(url.searchParams.get('fallback_android')).toBe('google-play');
    expect(url.searchParams.get('fallback_ios')).toBe('itunes-appstore');
    expect(url.searchParams.get('fallback_desktop')).toBe(`https://get-thesi.com/r/${code}`);
  });
});
