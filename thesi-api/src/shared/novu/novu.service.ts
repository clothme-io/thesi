import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type NovuWorkflowEvent =
  | {
      type: 'creator_application_received';
      toEmail: string;
      subscriberId?: string;
      firstName: string;
    }
  | {
      type: 'creator_account_approved';
      toEmail: string;
      subscriberId?: string;
      firstName: string;
      temporaryPassword: string;
    }
  | {
      type: 'password_reset';
      toEmail: string;
      subscriberId?: string;
      firstName: string;
      resetUrl: string;
    }
  | {
      type: 'brand_welcome';
      toEmail: string;
      subscriberId?: string;
      firstName: string;
    }
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
    }
  | {
      type: 'marketplace_application_received';
      toEmail: string;
      subscriberId?: string;
      creatorName: string;
      brandName: string;
      campaignTitle: string;
      listingId: string;
      applicationId: string;
    }
  | {
      type: 'marketplace_application_status';
      toEmail: string;
      subscriberId?: string;
      creatorName: string;
      campaignTitle: string;
      status: 'accepted' | 'rejected';
      message?: string;
      listingId: string;
      applicationId: string;
    }
  | {
      type: 'campaign_invite_response';
      toEmail: string;
      subscriberId?: string;
      brandUserName: string;
      creatorName: string;
      campaignTitle: string;
      response: 'accepted' | 'declined';
      campaignId: string;
    }
  | {
      type: 'crm_workspace_invite';
      toEmail: string;
      subscriberId?: string;
      recipientName: string;
      inviterName: string;
      workspaceName: string;
      inviteToken: string;
    }
  | {
      type: 'creator_invoice_sent';
      toEmail: string;
      subscriberId?: string;
      brandContactName: string;
      creatorName: string;
      dealName: string;
      amount: string;
      currency: string;
      invoiceUrl: string;
    }
  | {
      type: 'creator_payment_marked_paid';
      toEmail: string;
      subscriberId?: string;
      creatorName: string;
      dealName: string;
      amount: string;
      currency: string;
    };

@Injectable()
export class NovuService {
  private readonly logger = new Logger(NovuService.name);
  private readonly apiKey: string | null;
  private readonly apiUrl: string;
  private readonly webUrl: string;
  private readonly workflowIds: Record<NovuWorkflowEvent['type'], string>;

  constructor(private readonly configService: ConfigService) {
    const key =
      this.configService.get<string>('NOVU_API_KEY')?.trim() ||
      this.environmentApiKey();
    this.apiKey = key || null;
    this.apiUrl = (
      this.configService.get<string>('NOVU_API_URL') || 'https://api.novu.co'
    ).replace(/\/+$/, '');
    this.webUrl = this.configService
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');
    this.workflowIds = {
      creator_application_received:
        this.workflowId('NOVU_CREATOR_APPLICATION_RECEIVED_WORKFLOW_ID') ||
        'thesi-creator-application-received',
      creator_account_approved:
        this.workflowId('NOVU_CREATOR_ACCOUNT_APPROVED_WORKFLOW_ID') ||
        'thesi-creator-account-approved',
      password_reset:
        this.workflowId('NOVU_PASSWORD_RESET_WORKFLOW_ID') ||
        'thesi-password-reset',
      brand_welcome:
        this.workflowId('NOVU_BRAND_WELCOME_WORKFLOW_ID') ||
        'thesi-brand-welcome',
      campaign_invite:
        this.workflowId('NOVU_CAMPAIGN_INVITE_WORKFLOW_ID') ||
        'thesi-campaign-invite',
      platform_invite_brand:
        this.workflowId('NOVU_PLATFORM_BRAND_INVITE_WORKFLOW_ID') ||
        'thesi-platform-brand-invite',
      marketplace_application_received:
        this.workflowId('NOVU_MARKETPLACE_APPLICATION_RECEIVED_WORKFLOW_ID') ||
        'thesi-marketplace-application-received',
      marketplace_application_status:
        this.workflowId('NOVU_MARKETPLACE_APPLICATION_STATUS_WORKFLOW_ID') ||
        'thesi-marketplace-application-status',
      campaign_invite_response:
        this.workflowId('NOVU_CAMPAIGN_INVITE_RESPONSE_WORKFLOW_ID') ||
        'thesi-campaign-invite-response',
      crm_workspace_invite:
        this.workflowId('NOVU_CRM_WORKSPACE_INVITE_WORKFLOW_ID') ||
        'thesi-crm-workspace-invite',
      creator_invoice_sent:
        this.workflowId('NOVU_CREATOR_INVOICE_SENT_WORKFLOW_ID') ||
        'thesi-creator-invoice-sent',
      creator_payment_marked_paid:
        this.workflowId('NOVU_CREATOR_PAYMENT_MARKED_PAID_WORKFLOW_ID') ||
        'thesi-creator-payment-marked-paid',
    };

    if (!this.apiKey) {
      this.logger.warn(
        'NOVU_API_KEY is not set — invite workflows will be logged only',
      );
    }
  }

  async trigger(event: NovuWorkflowEvent): Promise<string | null> {
    const transactionId = randomUUID();
    const workflowId = this.workflowIds[event.type];
    const payload = this.buildPayload(event);

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
          subscriberId: event.subscriberId ?? `email:${event.toEmail}`,
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

  private workflowId(envKey: string): string | undefined {
    return this.configService.get<string>(envKey)?.trim() || undefined;
  }

  private environmentApiKey(): string | undefined {
    const envKey =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? 'NOVU_PROD_API_KEY'
        : 'NOVU_DEV_API_KEY';
    return this.configService.get<string>(envKey)?.trim() || undefined;
  }

  private buildPayload(event: NovuWorkflowEvent): Record<string, unknown> {
    switch (event.type) {
      case 'creator_application_received':
        return { firstName: event.firstName };
      case 'creator_account_approved':
        return {
          firstName: event.firstName,
          email: event.toEmail,
          temporaryPassword: event.temporaryPassword,
          signInUrl: `${this.webUrl}/sign-in`,
        };
      case 'password_reset':
        return {
          firstName: event.firstName,
          resetUrl: event.resetUrl,
        };
      case 'brand_welcome':
        return {
          firstName: event.firstName,
          signInUrl: `${this.webUrl}/sign-in`,
        };
      case 'campaign_invite':
        return {
          creatorName: event.creatorName,
          brandName: event.brandName,
          campaignName: event.campaignName,
          campaignTitle: event.campaignName,
          campaignId: event.campaignId,
          inviteId: event.inviteId,
          external: event.external,
          inboxUrl: `${this.webUrl}/app/inbox`,
          inviteUrl: `${this.webUrl}/app/inbox`,
          signInUrl: `${this.webUrl}/sign-in`,
        };
      case 'platform_invite_brand':
        return {
          brandName: event.brandName,
          recipientName: event.brandName,
          invitedBy: event.invitedBy,
          inviteId: event.inviteId,
          message: event.message ?? '',
          inviteUrl: `${this.webUrl}/sign-up`,
          signInUrl: `${this.webUrl}/sign-in`,
          signUpUrl: `${this.webUrl}/sign-up`,
        };
      case 'marketplace_application_received':
        return {
          creatorName: event.creatorName,
          brandName: event.brandName,
          campaignTitle: event.campaignTitle,
          listingId: event.listingId,
          applicationId: event.applicationId,
          listingUrl: `${this.webUrl}/app/marketplace/${event.listingId}`,
        };
      case 'marketplace_application_status':
        return {
          creatorName: event.creatorName,
          campaignTitle: event.campaignTitle,
          status: event.status,
          message: event.message ?? '',
          listingId: event.listingId,
          applicationId: event.applicationId,
          listingUrl: `${this.webUrl}/app/marketplace/${event.listingId}`,
        };
      case 'campaign_invite_response':
        return {
          brandUserName: event.brandUserName,
          creatorName: event.creatorName,
          campaignTitle: event.campaignTitle,
          response: event.response,
          campaignId: event.campaignId,
          campaignUrl: `${this.webUrl}/app/campaigns/${event.campaignId}`,
        };
      case 'crm_workspace_invite':
        return {
          recipientName: event.recipientName,
          inviterName: event.inviterName,
          workspaceName: event.workspaceName,
          inviteUrl: `${this.webUrl}/app/crm/collaboration?token=${encodeURIComponent(
            event.inviteToken,
          )}`,
        };
      case 'creator_invoice_sent':
        return {
          brandContactName: event.brandContactName,
          creatorName: event.creatorName,
          dealName: event.dealName,
          amount: event.amount,
          currency: event.currency,
          invoiceUrl: event.invoiceUrl,
        };
      case 'creator_payment_marked_paid':
        return {
          creatorName: event.creatorName,
          dealName: event.dealName,
          amount: event.amount,
          currency: event.currency,
        };
    }
  }
}
