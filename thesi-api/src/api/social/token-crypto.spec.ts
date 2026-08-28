import { decryptSecret, encryptSecret } from './token-crypto';

describe('token-crypto', () => {
  it('round-trips a secret', () => {
    const payload = encryptSecret('tiktok-access-token', 'test-key-material');
    expect(payload.split('.')).toHaveLength(3);
    expect(decryptSecret(payload, 'test-key-material')).toBe('tiktok-access-token');
  });

  it('fails when the key material does not match', () => {
    const payload = encryptSecret('secret', 'key-a');
    expect(() => decryptSecret(payload, 'key-b')).toThrow();
  });
});
