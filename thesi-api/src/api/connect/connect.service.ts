import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from 'src/shared/stripe/stripe.service';
import {
  CONNECT_REPOSITORY,
  type ConnectRepository,
  type ConnectUser,
} from './connect.repository';

export type ConnectStatus = {
  stripeConfigured: boolean;
  status: 'not_started' | 'pending' | 'complete' | 'unavailable';
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  readyForPayouts: boolean;
};

@Injectable()
export class ConnectService {
  constructor(
    @Inject(CONNECT_REPOSITORY)
    private readonly connect: ConnectRepository,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Brand-facing readiness check for paying a creator (does not require
   * the authenticated user to be that creator).
   */
  async getCreatorPayoutReadiness(creatorUserId: string): Promise<{
    ready: boolean;
    accountId: string | null;
    reason?: string;
  }> {
    const user = await this.connect.getUser(creatorUserId);
    if (!user || user.role !== 'creator') {
      return {
        ready: false,
        accountId: null,
        reason: 'Creator account not found',
      };
    }
    if (!this.stripe.isConfigured()) {
      // Offline / E2E: ensure a local Connect account id so payouts can be stubbed.
      let accountId = user.stripeConnectAccountId;
      if (!accountId) {
        accountId = `acct_local_${creatorUserId.replace(/-/g, '').slice(0, 16)}`;
        await this.connect.saveStripeConnectAccountId(creatorUserId, accountId);
      }
      return { ready: true, accountId };
    }

    if (!user.stripeConnectAccountId) {
      return {
        ready: false,
        accountId: null,
        reason: 'Creator has not started Stripe Connect onboarding',
      };
    }

    const live = await this.stripe.retrieveConnectAccount(
      user.stripeConnectAccountId,
    );
    const ready = live.payoutsEnabled && live.detailsSubmitted;
    return {
      ready,
      accountId: live.accountId,
      ...(ready
        ? {}
        : {
            reason:
              'Creator must finish Stripe payout setup (Settings → Payouts)',
          }),
    };
  }

  async getStatus(userId: string): Promise<ConnectStatus> {
    const user = await this.requireCreator(userId);
    if (!this.stripe.isConfigured()) {
      return {
        stripeConfigured: false,
        status: 'unavailable',
        accountId: user.stripeConnectAccountId,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        readyForPayouts: false,
      };
    }

    if (!user.stripeConnectAccountId) {
      return {
        stripeConfigured: true,
        status: 'not_started',
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        readyForPayouts: false,
      };
    }

    const live = await this.stripe.retrieveConnectAccount(
      user.stripeConnectAccountId,
    );
    const readyForPayouts = live.payoutsEnabled && live.detailsSubmitted;
    return {
      stripeConfigured: true,
      status: readyForPayouts ? 'complete' : 'pending',
      accountId: live.accountId,
      detailsSubmitted: live.detailsSubmitted,
      chargesEnabled: live.chargesEnabled,
      payoutsEnabled: live.payoutsEnabled,
      readyForPayouts,
    };
  }

  async createAccountLink(
    userId: string,
    input: { refreshUrl?: string; returnUrl?: string },
  ): Promise<{ url: string; expiresAt: number; accountId: string }> {
    const user = await this.requireCreator(userId);
    if (!this.stripe.isConfigured()) {
      throw new ServiceUnavailableException(
        'Stripe is not configured (STRIPE_SECRET_KEY)',
      );
    }

    const accountId = await this.ensureAccount(user);
    const defaults = this.defaultUrls();
    const refreshUrl = input.refreshUrl?.trim() || defaults.refreshUrl;
    const returnUrl = input.returnUrl?.trim() || defaults.returnUrl;
    this.assertAllowedUrl(refreshUrl);
    this.assertAllowedUrl(returnUrl);

    const link = await this.stripe.createAccountLink({
      accountId,
      refreshUrl,
      returnUrl,
    });
    return { ...link, accountId };
  }

  async createLoginLink(userId: string): Promise<{ url: string }> {
    const user = await this.requireCreator(userId);
    if (!this.stripe.isConfigured()) {
      throw new ServiceUnavailableException(
        'Stripe is not configured (STRIPE_SECRET_KEY)',
      );
    }
    if (!user.stripeConnectAccountId) {
      throw new BadRequestException(
        'Connect onboarding has not been started',
      );
    }
    const live = await this.stripe.retrieveConnectAccount(
      user.stripeConnectAccountId,
    );
    if (!live.detailsSubmitted) {
      throw new BadRequestException(
        'Finish Stripe onboarding before opening the dashboard',
      );
    }
    const link = await this.stripe.createLoginLink(user.stripeConnectAccountId);
    if (!link.url) {
      throw new ServiceUnavailableException(
        'Stripe Express dashboard is unavailable in local stub mode',
      );
    }
    return link;
  }

  private async ensureAccount(user: ConnectUser): Promise<string> {
    if (user.stripeConnectAccountId) {
      return user.stripeConnectAccountId;
    }
    const accountId = await this.stripe.createExpressAccount({
      email: user.email,
      creatorUserId: user.id,
    });
    await this.connect.saveStripeConnectAccountId(user.id, accountId);
    return accountId;
  }

  private defaultUrls() {
    const web = this.config
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');
    return {
      refreshUrl: `${web}/app/settings?connect=refresh`,
      returnUrl: `${web}/app/settings?connect=return`,
    };
  }

  private assertAllowedUrl(url: string) {
    const web = this.config
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    const allowed = new URL(web);
    if (parsed.origin !== allowed.origin) {
      throw new BadRequestException(
        'returnUrl and refreshUrl must match THESI_WEB_URL origin',
      );
    }
  }

  private async requireCreator(userId: string): Promise<ConnectUser> {
    const user = await this.connect.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    return user;
  }
}
