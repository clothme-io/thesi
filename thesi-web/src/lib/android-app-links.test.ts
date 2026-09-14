import { describe, expect, it } from 'vitest';
import { androidAssetLinks } from './android-app-links';

const fingerprint = Array(32).fill('AB').join(':');
describe('Android domain association', () => {
  it('publishes no association unless explicitly enabled and configured', () => {
    expect(androidAssetLinks({})).toEqual([]);
    expect(androidAssetLinks({ CLOTHME_ANDROID_SIGNING_SHA256: fingerprint })).toEqual([]);
    expect(androidAssetLinks({ CLOTHME_ANDROID_APP_LINKS_ENABLED: 'true' })).toEqual([]);
  });
  it('rejects malformed certificates, including a mixed valid/invalid list', () => {
    for (const value of ['AB:CD', fingerprint.replaceAll(':', ''), `${fingerprint},invalid`]) {
      expect(androidAssetLinks({ CLOTHME_ANDROID_APP_LINKS_ENABLED: 'true', CLOTHME_ANDROID_SIGNING_SHA256: value })).toEqual([]);
    }
  });
  it('supports certificate rotation, normalizes case and removes duplicates', () => {
    const second = Array(32).fill('CD').join(':');
    expect(androidAssetLinks({
      CLOTHME_ANDROID_APP_LINKS_ENABLED: 'true',
      CLOTHME_ANDROID_SIGNING_SHA256: ` ${fingerprint.toLowerCase()},${second},${fingerprint} `,
    })).toEqual([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'io.patheos.clothme', sha256_cert_fingerprints: [fingerprint, second] },
    }]);
  });
});
