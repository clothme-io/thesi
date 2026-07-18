import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { InboxService } from 'src/api/inbox/inbox.service';
import type { NovuService } from 'src/shared/novu/novu.service';
import type {
  CampaignInviteRecord,
  InviteUser,
  InvitesRepository,
  PlatformBrandInviteRecord,
} from './invites.repository';
import { InvitesService } from './invites.service';

class FakeInvitesRepository implements InvitesRepository {
  users = new Map<string, InviteUser>();
  campaigns = new Map<string, { id: string; name: string; ownerUserId: string }>();
  campaignInvites: CampaignInviteRecord[] = [];
  platformInvites: PlatformBrandInviteRecord[] = [];

  async getUser(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async findUserByEmail(email: string) {
    return (
      [...this.users.values()].find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async findOwnedCampaign(brandUserId: string, campaignId: string) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.ownerUserId !== brandUserId) return null;
    return { id: campaign.id, name: campaign.name };
  }

  async listCampaignInvites(brandUserId: string, campaignId?: string) {
    return this.campaignInvites.filter(
      (invite) =>
        (!campaignId || invite.campaignId === campaignId) &&
        this.campaignInvites.includes(invite),
    );
  }

  async findCampaignInviteByEmail(campaignId: string, creatorEmail: string) {
    return (
      this.campaignInvites.find(
        (invite) =>
          invite.campaignId === campaignId &&
          invite.creatorEmail.toLowerCase() === creatorEmail.toLowerCase(),
      ) ?? null
    );
  }

  async createCampaignInvite(input: {
    campaignId: string;
    brandUserId: string;
    campaignName: string;
    brandName: string;
    creatorUserId?: string | null;
    creatorEmail: string;
    creatorName: string;
    external: boolean;
  }) {
    const invite: CampaignInviteRecord = {
      id: `invite-${this.campaignInvites.length + 1}`,
      campaignId: input.campaignId,
      campaignName: input.campaignName,
      brandName: input.brandName,
      ...(input.creatorUserId ? { creatorId: input.creatorUserId } : {}),
      creatorEmail: input.creatorEmail,
      creatorName: input.creatorName,
      external: input.external,
      status: 'sent',
      sentAt: new Date().toISOString(),
    };
    this.campaignInvites.push(invite);
    return invite;
  }

  async setCampaignInviteNovuTransactionId() {}

  async listPlatformBrandInvites() {
    return this.platformInvites;
  }

  async findPlatformBrandInviteByEmail(
    _invitedByUserId: string,
    brandEmail: string,
  ) {
    return (
      this.platformInvites.find(
        (invite) => invite.brandEmail.toLowerCase() === brandEmail.toLowerCase(),
      ) ?? null
    );
  }

  async createPlatformBrandInvite(input: {
    invitedByUserId: string;
    brandName: string;
    brandEmail: string;
    invitedByName: string;
    invitedByEmail: string;
    message?: string | null;
    addToCrm: boolean;
    crmBrandId?: string | null;
  }) {
    const invite: PlatformBrandInviteRecord = {
      id: `pinv-${this.platformInvites.length + 1}`,
      brandName: input.brandName,
      brandEmail: input.brandEmail,
      invitedBy: input.invitedByName,
      invitedByEmail: input.invitedByEmail,
      ...(input.message ? { message: input.message } : {}),
      addToCrm: input.addToCrm,
      ...(input.crmBrandId ? { crmBrandId: input.crmBrandId } : {}),
      status: 'sent',
      sentAt: new Date().toISOString(),
    };
    this.platformInvites.push(invite);
    return invite;
  }

  async setPlatformBrandInviteNovuTransactionId() {}
}

describe('InvitesService', () => {
  let repository: FakeInvitesRepository;
  let inbox: {
    deliverCampaignInvite: jest.Mock;
    notifySelf: jest.Mock;
  };
  let novu: { trigger: jest.Mock };
  let service: InvitesService;

  beforeEach(() => {
    repository = new FakeInvitesRepository();
    repository.users.set('brand-1', {
      id: 'brand-1',
      role: 'brand',
      email: 'brand@example.com',
      fullName: 'Acme Brand',
    });
    repository.users.set('creator-1', {
      id: 'creator-1',
      role: 'creator',
      email: 'creator@example.com',
      fullName: 'Alex Creator',
    });
    repository.campaigns.set('camp-1', {
      id: 'camp-1',
      name: 'Summer Drop',
      ownerUserId: 'brand-1',
    });
    inbox = {
      deliverCampaignInvite: jest.fn().mockResolvedValue({ delivered: true }),
      notifySelf: jest.fn().mockResolvedValue({}),
    };
    novu = {
      trigger: jest.fn().mockResolvedValue('txn-1'),
    };
    const creatorCrm = {
      ensureProspectBrand: jest.fn().mockResolvedValue({
        id: 'crm-brand-1',
        name: 'Nike',
        email: 'brand@nike.com',
      }),
    };
    service = new InvitesService(
      repository,
      inbox as unknown as InboxService,
      novu as unknown as NovuService,
      creatorCrm as never,
    );
  });

  it('creates an internal campaign invite, delivers inbox, and triggers Novu', async () => {
    const invite = await service.createCampaignInvite('brand-1', {
      campaignId: 'camp-1',
      campaignName: 'Summer Drop',
      brandName: 'Acme',
      creatorId: 'creator-1',
      creatorEmail: 'creator@example.com',
      creatorName: 'Alex Creator',
      external: false,
    });

    expect(invite.creatorId).toBe('creator-1');
    expect(inbox.deliverCampaignInvite).toHaveBeenCalled();
    expect(novu.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'campaign_invite' }),
    );
  });

  it('skips inbox delivery for external campaign invites', async () => {
    await service.createCampaignInvite('brand-1', {
      campaignId: 'camp-1',
      campaignName: 'Summer Drop',
      brandName: 'Acme',
      creatorEmail: 'external@example.com',
      creatorName: 'External Creator',
      external: true,
    });

    expect(inbox.deliverCampaignInvite).not.toHaveBeenCalled();
    expect(novu.trigger).toHaveBeenCalled();
  });

  it('rejects duplicate campaign invites', async () => {
    await service.createCampaignInvite('brand-1', {
      campaignId: 'camp-1',
      campaignName: 'Summer Drop',
      brandName: 'Acme',
      creatorEmail: 'creator@example.com',
      creatorName: 'Alex',
      external: false,
    });

    await expect(
      service.createCampaignInvite('brand-1', {
        campaignId: 'camp-1',
        campaignName: 'Summer Drop',
        brandName: 'Acme',
        creatorEmail: 'creator@example.com',
        creatorName: 'Alex',
        external: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a brand account for campaign invites', async () => {
    await expect(
      service.createCampaignInvite('creator-1', {
        campaignId: 'camp-1',
        campaignName: 'Summer Drop',
        brandName: 'Acme',
        creatorEmail: 'other@example.com',
        creatorName: 'Other',
        external: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a platform brand invite with sender notification and Novu', async () => {
    const invite = await service.createPlatformBrandInvite('creator-1', {
      brandName: 'Nike',
      brandEmail: 'brand@nike.com',
      invitedBy: 'Alex Creator',
      invitedByEmail: 'creator@example.com',
      addToCrm: true,
      crmBrandId: 'crm-1',
    });

    expect(invite.brandEmail).toBe('brand@nike.com');
    expect(inbox.notifySelf).toHaveBeenCalled();
    expect(novu.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'platform_invite_brand' }),
    );
  });

  it('requires creator account for platform brand invites', async () => {
    await expect(
      service.createPlatformBrandInvite('brand-1', {
        brandName: 'Nike',
        brandEmail: 'brand@nike.com',
        invitedBy: 'Acme',
        invitedByEmail: 'brand@example.com',
        addToCrm: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails when internal creator cannot be resolved', async () => {
    await expect(
      service.createCampaignInvite('brand-1', {
        campaignId: 'camp-1',
        campaignName: 'Summer Drop',
        brandName: 'Acme',
        creatorEmail: 'missing@example.com',
        creatorName: 'Missing',
        external: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
