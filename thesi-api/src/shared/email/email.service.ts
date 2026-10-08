import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseFromAddress } from './from-address';

const MAILERSEND_EMAIL_URL = 'https://api.mailersend.com/v1/email';
const MAILTRAP_SEND_URL = 'https://send.api.mailtrap.io/api/send';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface CampaignPublishedEmailInput {
  to: string;
  creatorName: string;
  campaignName: string;
  brandName: string;
  description?: string | null;
  contentTypes: string[];
  startDate: string;
  endDate: string;
  paymentSummary: string;
  listingUrl: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly mailerSendKey: string | null;
  private readonly mailtrapKey: string | null;
  private readonly fromEmail: string;
  private readonly signInUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.mailerSendKey =
      this.configService.get<string>('MAILERSEND_API_KEY')?.trim() || null;
    this.mailtrapKey =
      this.configService.get<string>('MAILTRAP_API_KEY')?.trim() || null;
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') ||
      'Thesi <noreply@thesi.clothme.io>';
    const webUrl = this.configService
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');
    this.signInUrl = `${webUrl}/sign-in`;

    if (!this.mailerSendKey && !this.mailtrapKey) {
      this.logger.warn(
        'No email provider configured — emails will be logged only',
      );
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (this.mailerSendKey) {
      try {
        await this.sendViaMailerSend(options);
        return;
      } catch (error) {
        if (!this.mailtrapKey) {
          throw error;
        }
        const message =
          error instanceof Error ? error.message : 'MailerSend send failed';
        this.logger.warn(`MailerSend failed, falling back to Mailtrap: ${message}`);
      }
    }

    if (this.mailtrapKey) {
      await this.sendViaMailtrap(options);
      return;
    }

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('Email provider is not configured');
    }

    this.logger.log(`[EMAIL] To: ${options.to} | Subject: ${options.subject}`);
  }

  private async sendViaMailerSend(options: SendEmailOptions): Promise<void> {
    const from = parseFromAddress(this.fromEmail);
    const response = await fetch(MAILERSEND_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.mailerSendKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [{ email: options.to }],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `MailerSend delivery failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }
  }

  private async sendViaMailtrap(options: SendEmailOptions): Promise<void> {
    const from = parseFromAddress(this.fromEmail);
    const response = await fetch(MAILTRAP_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.mailtrapKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'thesi-api',
      },
      body: JSON.stringify({
        from,
        to: [{ email: options.to }],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Mailtrap delivery failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }
  }

  async sendCreatorApplicationConfirmation(
    to: string,
    fullName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'We received your Thesi creator application',
      html: `
        <p>Hi ${fullName},</p>
        <p>Thank you for applying to join Thesi — the UGC business platform from ClothME.</p>
        <p>Our team reviews every application. Selected creators will receive an invitation by email.</p>
        <p>— The Thesi Team</p>
      `,
      text: `Hi ${fullName}, thank you for applying to Thesi. We received your application and will be in touch.`,
    });
  }

  async sendCreatorAccountReady(
    to: string,
    fullName: string,
    tempPassword: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Your Thesi creator account is ready',
      html: `
        <p>Hi ${fullName},</p>
        <p>Your creator application was approved. Your Thesi account is ready.</p>
        <p>Sign in at <a href="${this.signInUrl}">${this.signInUrl}</a> with:</p>
        <ul>
          <li><strong>Email:</strong> ${to}</li>
          <li><strong>Temporary password:</strong> ${tempPassword}</li>
        </ul>
        <p>You will be asked to set a new password on first sign-in.</p>
        <p>— The Thesi Team</p>
      `,
      text: `Hi ${fullName}, your Thesi creator account is ready. Sign in at ${this.signInUrl} with ${to} and temporary password: ${tempPassword}. You must set a new password on first sign-in.`,
    });
  }

  async sendPasswordReset(
    to: string,
    fullName: string,
    resetUrl: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your Thesi password',
      html: `
        <p>Hi ${fullName || 'there'},</p>
        <p>We received a request to reset your Thesi password.</p>
        <p><a href="${resetUrl}">Choose a new password</a></p>
        <p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>
        <p>— The Thesi Team</p>
      `,
      text: `Hi ${fullName || 'there'}, reset your Thesi password: ${resetUrl}. This link expires in one hour. If you did not request a reset, ignore this email.`,
    });
  }

  async sendCampaignPublishedToCreator(
    input: CampaignPublishedEmailInput,
  ): Promise<void> {
    const creatorName = escapeHtml(input.creatorName || 'there');
    const campaignName = escapeHtml(input.campaignName);
    const brandName = escapeHtml(input.brandName);
    const description = truncate(input.description?.trim() || '', 240);
    const contentTypes = input.contentTypes
      .map(formatContentType)
      .filter(Boolean)
      .join(', ');
    const paymentSummary = escapeHtml(input.paymentSummary);
    const listingUrl = escapeHtml(input.listingUrl);

    await this.send({
      to: input.to,
      subject: `New Thesi campaign from ${input.brandName}: ${input.campaignName}`,
      html: `
        <p>Hi ${creatorName},</p>
        <p><strong>${brandName}</strong> just published a new creator campaign on Thesi.</p>
        <h2>${campaignName}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        <ul>
          <li><strong>Content:</strong> ${escapeHtml(contentTypes || 'Creator content')}</li>
          <li><strong>Timeline:</strong> ${escapeHtml(input.startDate)} to ${escapeHtml(input.endDate)}</li>
          <li><strong>Payment:</strong> ${paymentSummary}</li>
        </ul>
        <p><a href="${listingUrl}">View campaign in Thesi</a></p>
        <p>Open the campaign to see if you are interested.</p>
        <p>— The Thesi Team</p>
      `,
      text: `Hi ${input.creatorName || 'there'}, ${input.brandName} just published a new creator campaign on Thesi: ${input.campaignName}. Content: ${contentTypes || 'Creator content'}. Timeline: ${input.startDate} to ${input.endDate}. Payment: ${input.paymentSummary}. Open the campaign to see if you are interested: ${input.listingUrl}`,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatContentType(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
