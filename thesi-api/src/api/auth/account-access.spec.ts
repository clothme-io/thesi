import {
  canRequestPasswordReset,
  signInDenial,
  signInDeniedMessage,
} from './account-access';

describe('creator account access', () => {
  it('blocks a pending creator before any password check', () => {
    expect(
      signInDenial({ accountStatus: 'pending', passwordHash: '$pending$' }),
    ).toBe('pending');
    expect(signInDeniedMessage('pending')).toBe(
      'Your creator application is still under review',
    );
    expect(
      canRequestPasswordReset({
        accountStatus: 'pending',
        passwordHash: '$pending$',
      }),
    ).toBe(false);
  });

  it('blocks a rejected creator account', () => {
    expect(
      signInDenial({ accountStatus: 'disabled', passwordHash: '$pending$' }),
    ).toBe('disabled');
    expect(signInDeniedMessage('disabled')).toBe(
      'This account is not available',
    );
    expect(
      canRequestPasswordReset({
        accountStatus: 'disabled',
        passwordHash: '$pending$',
      }),
    ).toBe(false);
  });

  it('allows an active password account to sign in and reset', () => {
    const user = { accountStatus: 'active', passwordHash: '$2b$hash' };
    expect(signInDenial(user)).toBeNull();
    expect(canRequestPasswordReset(user)).toBe(true);
  });

  it('treats a missing account and merchant-linked accounts as invalid credentials', () => {
    expect(signInDenial(undefined)).toBe('invalid');
    expect(
      signInDenial({ accountStatus: 'active', passwordHash: '$external$abc' }),
    ).toBe('invalid');
    expect(
      canRequestPasswordReset({
        accountStatus: 'active',
        passwordHash: '$external$abc',
      }),
    ).toBe(false);
  });

  it('treats accounts created before the status column as active', () => {
    const user = { passwordHash: '$2b$hash' };
    expect(signInDenial(user)).toBeNull();
    expect(canRequestPasswordReset(user)).toBe(true);
  });
});
