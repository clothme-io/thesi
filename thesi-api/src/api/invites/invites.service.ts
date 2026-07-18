import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatorCrmService } from 'src/api/creator-crm/creator-crm.service';
import { InboxService } from 'src/api/inbox/inbox.service';
import { NovuService } from 'src/shared/novu/novu.service';
import {
  INVITES_REPOSITORY,
  type CampaignInviteRecord,
  type InvitesRepository,
  type PlatformBrandInviteRecord,
} from './invites.repository';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    @Inject(INVITES_REPOSITORY)
    private readonly invites: InvitesRepository,
    private readonly inbox: InboxService,
    private readonly novu: NovuService,
    private readonly creatorCrm: CreatorCrmService,
  ) {}

  async listCampaignInvites(
    userId: string,
    campaignId?: string,
  ): Promise<{ invites: CampaignInviteRecord[] }> {
    const user = await this.requireUser(userId);
    if (user.role !== 'brand') {
      throw new ForbiddenException('Brand account required');
    }
    const invites = await this.invites.listCampaignInvites(userId, campaignId);
    return { invites };
  }

  async createCampaignInvite(
    userId: string,
    input: {
      campaignId: string;
      campaignName: string;
      brandName: string;
      creatorId?: string;
      creatorEmail: string;
      creatorName: string;
      external: boolean;
    },
  ): Promise<CampaignInviteRecord> {
    const user = await this.requireUser(userId);
    if (user.role !== 'brand') {
      throw new ForbiddenException('Brand account required');
    }

    const campaignId = input.campaignId.trim();
    const creatorEmail = input.creatorEmail.trim().toLowerCase();
    const existing = await this.invites.findCampaignInviteByEmail(
      campaignId,
      creatorEmail,
    );
    if (existing) {
      throw new ConflictException('Creator already invited to this campaign');
    }

    const owned = await this.invites.findOwnedCampaign(userId, campaignId);
    const campaignName = owned?.name?.trim() || input.campaignName.trim();
    const brandName = input.brandName.trim() || user.fullName;

    let creatorUserId = input.creatorId?.trim() || null;
    if (!input.external) {
      const creator =
        (creatorUserId ? await this.invites.getUser(creatorUserId) : null) ??
        (await this.invites.findUserByEmail(creatorEmail));
      if (!creator || creator.role !== 'creator') {
        throw new NotFoundException(
          'Creator account not found for invite delivery',
        );
      }
      creatorUserId = creator.id;
    }

    const invite = await this.invites.createCampaignInvite({
      campaignId,
      brandUserId: userId,
      campaignName,
      brandName,
      creatorUserId,
      creatorEmail,
      creatorName: input.creatorName.trim(),
      external: input.external,
    });

    if (!invite.external) {
      await this.inbox.deliverCampaignInvite(userId, {
        creatorUserId: invite.creatorId,
        creatorEmail: invite.creatorEmail,
        creatorName: invite.creatorName,
        campaignId: invite.campaignId,
        campaignName: invite.campaignName,
        brandName: invite.brandName,
        external: false,
      });
    }

    try {
      const transactionId = await this.novu.trigger({
        type: 'campaign_invite',
        toEmail: invite.creatorEmail,
        subscriberId: invite.creatorId ?? `email:${invite.creatorEmail}`,
        creatorName: invite.creatorName,
        brandName: invite.brandName,
        campaignName: invite.campaignName,
        campaignId: invite.campaignId,
        inviteId: invite.id,
        external: invite.external,
      });
      if (transactionId) {
        await this.invites.setCampaignInviteNovuTransactionId(
          invite.id,
          transactionId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Novu campaign invite failed for ${invite.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return invite;
  }

  async listPlatformBrandInvites(
    userId: string,
  ): Promise<{ brandInvites: PlatformBrandInviteRecord[] }> {
    const user = await this.requireUser(userId);
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    const brandInvites = await this.invites.listPlatformBrandInvites(userId);
    return { brandInvites };
  }

  async createPlatformBrandInvite(
    userId: string,
    input: {
      brandName: string;
      brandEmail: string;
      invitedBy: string;
      invitedByEmail: string;
      message?: string;
      addToCrm: boolean;
      crmBrandId?: string;
    },
  ): Promise<PlatformBrandInviteRecord> {
    const user = await this.requireUser(userId);
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }

    const brandEmail = input.brandEmail.trim().toLowerCase();
    const existing = await this.invites.findPlatformBrandInviteByEmail(
      userId,
      brandEmail,
    );
    if (existing) {
      throw new ConflictException('Brand already invited');
    }

    let crmBrandId = input.crmBrandId;
    if (input.addToCrm) {
      const brand = await this.creatorCrm.ensureProspectBrand(userId, {
        name: input.brandName.trim(),
        email: brandEmail,
        contactName: input.brandName.trim(),
        tags: ['Invited via Thesi'],
        notes: 'Invited to join Thesi as a brand partner.',
      });
      crmBrandId = brand.id;
    }

    const invite = await this.invites.createPlatformBrandInvite({
      invitedByUserId: userId,
      brandName: input.brandName.trim(),
      brandEmail,
      invitedByName: input.invitedBy.trim() || user.fullName,
      invitedByEmail: input.invitedByEmail.trim().toLowerCase() || user.email,
      message: input.message,
      addToCrm: input.addToCrm,
      crmBrandId,
    });

    await this.inbox.notifySelf(userId, {
      type: 'platform_invite',
      title: 'Brand invite sent',
      body: `You invited ${invite.brandName} (${invite.brandEmail}) to join Thesi.${
        invite.addToCrm ? ' Added to CRM as prospect.' : ''
      }`,
      href: '/app/crm/brands',
      audience: 'creator',
    });

    try {
      const transactionId = await this.novu.trigger({
        type: 'platform_invite_brand',
        toEmail: invite.brandEmail,
        subscriberId: `email:${invite.brandEmail}`,
        brandName: invite.brandName,
        invitedBy: invite.invitedBy,
        inviteId: invite.id,
        message: invite.message,
      });
      if (transactionId) {
        await this.invites.setPlatformBrandInviteNovuTransactionId(
          invite.id,
          transactionId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Novu platform brand invite failed for ${invite.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return invite;
  }

  private async requireUser(userId: string) {
    const user = await this.invites.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    return user;
  }
}
