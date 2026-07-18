import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type NovuWorkflowEvent =
  | {
      type: 'campaign_invite';
      toEmail: string;
      subscriberId: string;
      creatorName: string;
      brandName: string;
      campaignName: string;
      campaignId: string;
      inviteId: string;
      external: boolean;
    }
  | {
      type: 'platform_invite_brand';
      toEmail: string;
      subscriberId: string;
      brandName: string;
      invitedBy: string;
      inviteId: string;
      message?: string;
    };

@Injectable()
export class NovuService {
  private readonly logger = new Logger(NovuService.name);
  private readonly apiKey: string | null;
  private readonly apiUrl: string;
  private readonly campaignInviteWorkflowId: string;
  private readonly platformBrandInviteWorkflowId: string;
  private readonly webUrl: string;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('NOVU_API_KEY')?.trim();
    this.apiKey = key || null;
    this.apiUrl = (
      this.configService.get<string>('NOVU_API_URL') ||
      'https://api.novu.co'
    ).replace(/\/+$/, '');
    this.campaignInviteWorkflowId =
      this.configService.get<string>('NOVU_CAMPAIGN_INVITE_WORKFLOW_ID') ||
      'campaign-invite';
    this.platformBrandInviteWorkflowId =
      this.configService.get<string>(
        'NOVU_PLATFORM_BRAND_INVITE_WORKFLOW_ID',
      ) || 'platform-invite-brand';
    this.webUrl = this.configService
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');

    if (!this.apiKey) {
      this.logger.warn(
        'NOVU_API_KEY is not set — invite workflows will be logged only',
      );
    }
  }

  async trigger(event: NovuWorkflowEvent): Promise<string | null> {
    const transactionId = randomUUID();
    const workflowId =
      event.type === 'campaign_invite'
        ? this.campaignInviteWorkflowId
        : this.platformBrandInviteWorkflowId;

    const payload =
      event.type === 'campaign_invite'
        ? {
            creatorName: event.creatorName,
            brandName: event.brandName,
            campaignName: event.campaignName,
            campaignId: event.campaignId,
            inviteId: event.inviteId,
            external: event.external,
            inboxUrl: `${this.webUrl}/app/inbox`,
            signInUrl: `${this.webUrl}/sign-in`,
          }
        : {
            brandName: event.brandName,
            invitedBy: event.invitedBy,
            inviteId: event.inviteId,
            message: event.message ?? '',
            signInUrl: `${this.webUrl}/sign-in`,
            signUpUrl: `${this.webUrl}/sign-up`,
          };

    if (!this.apiKey) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new Error('Novu is not configured');
      }
      this.logger.log(
        `[NOVU] workflow=${workflowId} to=${event.toEmail} transactionId=${transactionId} payload=${JSON.stringify(payload)}`,
      );
      return transactionId;
    }

    const response = await fetch(`${this.apiUrl}/v1/events/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: workflowId,
        to: {
          subscriberId: event.subscriberId,
          email: event.toEmail,
        },
        payload,
        transactionId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Novu trigger failed (${response.status}): ${body || response.statusText}`,
      );
    }

    return transactionId;
  }
}
