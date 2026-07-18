import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { StripeService } from 'src/shared/stripe/stripe.service';
import type { ConnectRepository, ConnectUser } from './connect.repository';
import { ConnectService } from './connect.service';

class FakeConnectRepository implements ConnectRepository {
  user: ConnectUser | null = {
    id: 'creator-1',
    role: 'creator',
    email: 'creator@example.com',
    fullName: 'Creator',
    stripeConnectAccountId: null,
  };

  async getUser(userId: string) {
    return this.user?.id === userId ? this.user : null;
  }

  async saveStripeConnectAccountId(
    userId: string,
    stripeConnectAccountId: string,
  ) {
    if (this.user?.id === userId) {
      this.user.stripeConnectAccountId = stripeConnectAccountId;
    }
  }
}

describe('ConnectService', () => {
  let repository: FakeConnectRepository;
  let stripe: {
    isConfigured: jest.Mock;
    createExpressAccount: jest.Mock;
    createAccountLink: jest.Mock;
    retrieveConnectAccount: jest.Mock;
    createLoginLink: jest.Mock;
  };
  let service: ConnectService;

  beforeEach(() => {
    repository = new FakeConnectRepository();
    stripe = {
      isConfigured: jest.fn().mockReturnValue(true),
      createExpressAccount: jest.fn().mockResolvedValue('acct_test_1'),
      createAccountLink: jest.fn().mockResolvedValue({
        url: 'https://connect.stripe.com/setup/test',
        expiresAt: 123,
      }),
      retrieveConnectAccount: jest.fn().mockResolvedValue({
        accountId: 'acct_test_1',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      }),
      createLoginLink: jest
        .fn()
        .mockResolvedValue({ url: 'https://connect.stripe.com/express/test' }),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as ConfigService;
    service = new ConnectService(
      repository,
      stripe as unknown as StripeService,
      config,
    );
  });

  it('returns not_started when no account exists', async () => {
    const status = await service.getStatus('creator-1');
    expect(status.status).toBe('not_started');
    expect(status.stripeConfigured).toBe(true);
  });

  it('creates an express account and account link', async () => {
    const link = await service.createAccountLink('creator-1', {});
    expect(link.accountId).toBe('acct_test_1');
    expect(link.url).toContain('stripe.com');
    expect(repository.user?.stripeConnectAccountId).toBe('acct_test_1');
  });

  it('rejects non-creators', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      email: 'b@example.com',
      fullName: 'Brand',
      stripeConnectAccountId: null,
    };
    await expect(service.getStatus('brand-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns unavailable when Stripe is not configured', async () => {
    stripe.isConfigured.mockReturnValue(false);
    const status = await service.getStatus('creator-1');
    expect(status.status).toBe('unavailable');
  });

  it('blocks login link before onboarding completes', async () => {
    repository.user!.stripeConnectAccountId = 'acct_test_1';
    await expect(service.createLoginLink('creator-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a login link when details are submitted', async () => {
    repository.user!.stripeConnectAccountId = 'acct_test_1';
    stripe.retrieveConnectAccount.mockResolvedValue({
      accountId: 'acct_test_1',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
    await expect(service.createLoginLink('creator-1')).resolves.toEqual({
      url: 'https://connect.stripe.com/express/test',
    });
  });

  it('fails account link when Stripe is unavailable', async () => {
    stripe.isConfigured.mockReturnValue(false);
    await expect(service.createAccountLink('creator-1', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
