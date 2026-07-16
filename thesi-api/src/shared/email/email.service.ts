import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly ses: SESClient | null;
  private readonly fromEmail: string;
  private readonly provider: 'resend' | 'ses' | 'log';

  constructor(private readonly configService: ConfigService) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const sesRegion = this.configService.get<string>('AWS_SES_REGION');
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'Thesi <noreply@thesi.clothme.io>';

    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.provider = 'resend';
    } else if (sesRegion) {
      this.ses = new SESClient({ region: sesRegion });
      this.provider = 'ses';
    } else {
      this.resend = null;
      this.ses = null;
      this.provider = 'log';
      this.logger.warn('No email provider configured — emails will be logged only');
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (this.provider === 'resend' && this.resend) {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return;
    }

    if (this.provider === 'ses' && this.ses) {
      await this.ses.send(
        new SendEmailCommand({
          Source: this.fromEmail,
          Destination: { ToAddresses: [options.to] },
          Message: {
            Subject: { Data: options.subject },
            Body: {
              Html: { Data: options.html },
              ...(options.text ? { Text: { Data: options.text } } : {}),
            },
          },
        }),
      );
      return;
    }

    this.logger.log(`[EMAIL] To: ${options.to} | Subject: ${options.subject}`);
  }

  async sendCreatorApplicationConfirmation(to: string, fullName: string): Promise<void> {
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

  async sendCreatorAccountReady(to: string, fullName: string, tempPassword: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Thesi creator account is ready',
      html: `
        <p>Hi ${fullName},</p>
        <p>Your creator application was approved. Your Thesi account is ready.</p>
        <p>Sign in at <a href="https://thesi.clothme.io/sign-in">thesi.clothme.io/sign-in</a> with:</p>
        <ul>
          <li><strong>Email:</strong> ${to}</li>
          <li><strong>Temporary password:</strong> ${tempPassword}</li>
        </ul>
        <p>You will be asked to set a new password on first sign-in.</p>
        <p>— The Thesi Team</p>
      `,
      text: `Hi ${fullName}, your Thesi creator account is ready. Sign in with ${to} and temporary password: ${tempPassword}. You must set a new password on first sign-in.`,
    });
  }
}
