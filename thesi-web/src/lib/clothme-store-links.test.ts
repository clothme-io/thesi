import { describe,it,expect,vi,afterEach } from 'vitest';
import { clothmeStoreLinks } from './clothme-store-links';
import { GET } from '@/app/.well-known/apple-app-site-association/route';
afterEach(()=>vi.unstubAllEnvs());
describe('release link configuration',()=>{
  it('hides missing, insecure and unrelated store destinations',()=>{
    expect(clothmeStoreLinks({})).toEqual({ios:undefined,android:undefined});
    for(const value of ['https://evil.test/app/id123','http://apps.apple.com/app/id123','https://user@apps.apple.com/app/id123'])expect(clothmeStoreLinks({CLOTHME_IOS_STORE_URL:value}).ios).toBeUndefined();
    expect(clothmeStoreLinks({CLOTHME_ANDROID_STORE_URL:'https://play.google.com/store/apps/details?id=other.app'}).android).toBeUndefined();
  });
  it('accepts only supported store hosts and the known Android app',()=>{
    const ios='https://apps.apple.com/us/app/clothme/id123';const android='https://play.google.com/store/apps/details?id=io.patheos.clothme';
    expect(clothmeStoreLinks({CLOTHME_IOS_STORE_URL:ios,CLOTHME_ANDROID_STORE_URL:android})).toEqual({ios,android});
  });
  it('serves iOS association only when enabled and only for creator routes',async()=>{
    vi.stubEnv('CLOTHME_IOS_APP_LINKS_ENABLED','false');
    expect((await GET().json()).applinks.details).toEqual([]);
    vi.stubEnv('CLOTHME_IOS_APP_LINKS_ENABLED','true');
    expect((await GET().json()).applinks.details).toEqual([{appID:'A765V39MA5.io.patheos.clothme',paths:['/r/*']}]);
  });
});
