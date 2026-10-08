export const PENDING_PASSWORD_HASH = '$pending$';

export type AccountStatus = 'pending' | 'active' | 'disabled';

export function normalizeAccountStatus(
  status: string | null | undefined,
): AccountStatus {
  if (status === 'pending' || status === 'disabled') return status;
  return 'active';
}

export type SignInDenial = 'invalid' | 'pending' | 'disabled';

export function signInDenial(
  user:
    | {
        accountStatus?: string | null;
        passwordHash: string;
      }
    | null
    | undefined,
): SignInDenial | null {
  if (!user || user.passwordHash.startsWith('$external$')) return 'invalid';
  const status = normalizeAccountStatus(user.accountStatus);
  if (status === 'disabled') return 'disabled';
  if (status === 'pending' || user.passwordHash === PENDING_PASSWORD_HASH) {
    return 'pending';
  }
  return null;
}

export function signInDeniedMessage(reason: SignInDenial): string {
  if (reason === 'pending') {
    return 'Your creator application is still under review';
  }
  if (reason === 'disabled') return 'This account is not available';
  return 'Invalid email or password';
}

export function canRequestPasswordReset(
  user:
    | {
        accountStatus?: string | null;
        passwordHash: string;
      }
    | null
    | undefined,
): boolean {
  if (!user || user.passwordHash.startsWith('$external$')) return false;
  if (user.passwordHash === PENDING_PASSWORD_HASH) return false;
  return normalizeAccountStatus(user.accountStatus) === 'active';
}
