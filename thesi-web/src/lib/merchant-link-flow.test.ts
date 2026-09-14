import { beforeEach, describe, expect, it } from 'vitest';
import { clearMerchantIntent, merchantReturnUrl, readMerchantIntent } from './merchant-link-flow';
const code = 'a'.repeat(43);
beforeEach(() => { sessionStorage.clear(); history.replaceState(null, '', '/merchant-link'); });
describe('Merchant connection browser state', () => {
  it('removes the one-time code from the address and restores it for sign-in/reload', () => {
    history.replaceState(null, '', `/merchant-link#code=${code}`);
    expect(readMerchantIntent()).toBe(code);
    expect(location.hash).toBe('');
    expect(readMerchantIntent()).toBe(code);
    clearMerchantIntent();
    expect(() => readMerchantIntent()).toThrow('missing');
  });
  it('does not accept invalid or expired browser state', () => {
    history.replaceState(null, '', '/merchant-link#code=invalid');
    expect(() => readMerchantIntent()).toThrow('Invalid');
    expect(location.hash).toBe('');
    sessionStorage.setItem('thesi_merchant_link_intent', JSON.stringify({ code, expiresAt: Date.now() - 1 }));
    expect(() => readMerchantIntent()).toThrow('expired');
  });
  it('accepts only web addresses on the fixed Merchant review path', () => {
    expect(merchantReturnUrl('https://merchant.example.test/app/settings/integrations/thesi#code=sample')).toContain('/app/settings/integrations/thesi');
    for (const url of ['javascript:alert(1)', 'https://merchant.example.test/elsewhere', 'https://user:secret@merchant.example.test/app/settings/integrations/thesi']) expect(() => merchantReturnUrl(url)).toThrow();
  });
});
