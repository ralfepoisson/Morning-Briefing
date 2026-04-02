import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';

export type ContactMessageInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export interface ContactMessageService {
  sendMessage(input: ContactMessageInput): Promise<void>;
}

export class ContactMessageConfigurationError extends Error {}
export type SesClientLike = Pick<SESv2Client, 'send'>;

export class SesContactMessageService implements ContactMessageService {
  constructor(
    private readonly config: {
      client: SesClientLike;
      toEmail: string;
      fromEmail: string;
    }
  ) {}

  async sendMessage(input: ContactMessageInput): Promise<void> {
    await this.config.client.send(new SendEmailCommand({
      FromEmailAddress: this.config.fromEmail,
      Destination: {
        ToAddresses: [this.config.toEmail]
      },
      ReplyToAddresses: [input.email],
      Content: {
        Simple: {
          Subject: {
            Data: `[Daily Briefing Contact] ${input.subject}`
          },
          Body: {
            Text: {
              Data: buildTextBody(input)
            }
          }
        }
      }
    }));
  }
}

export class SmtpContactMessageService implements ContactMessageService {
  private readonly transporter;

  constructor(
    private readonly config: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      toEmail: string;
      fromEmail: string;
    }
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  async sendMessage(input: ContactMessageInput): Promise<void> {
    await this.transporter.sendMail({
      to: this.config.toEmail,
      from: this.config.fromEmail,
      replyTo: input.email,
      subject: `[Daily Briefing Contact] ${input.subject}`,
      text: buildTextBody(input)
    });
  }
}

export function createContactMessageServiceFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ContactMessageService {
  const provider = normalizeString(env.CONTACT_DELIVERY_PROVIDER).toLowerCase();
  const fromEmail = normalizeString(env.CONTACT_FROM_EMAIL);
  const toEmail = normalizeString(env.CONTACT_TO_EMAIL) || 'ralfepoisson@gmail.com';
  const host = normalizeString(env.CONTACT_SMTP_HOST);
  const user = normalizeString(env.CONTACT_SMTP_USER);
  const pass = normalizeString(env.CONTACT_SMTP_PASS);

  if (!fromEmail) {
    throw new ContactMessageConfigurationError(
      'Contact form email delivery is not configured. Set CONTACT_FROM_EMAIL and either configure SES or provide SMTP credentials.'
    );
  }

  if (provider === 'smtp' || (host && user && pass)) {
    if (!host || !user || !pass) {
      throw new ContactMessageConfigurationError(
        'SMTP contact delivery requires CONTACT_SMTP_HOST, CONTACT_SMTP_USER, CONTACT_SMTP_PASS, and CONTACT_FROM_EMAIL.'
      );
    }

    return new SmtpContactMessageService({
      host,
      port: getPort(env.CONTACT_SMTP_PORT),
      secure: env.CONTACT_SMTP_SECURE === 'true',
      user,
      pass,
      toEmail,
      fromEmail
    });
  }

  const region = normalizeString(env.CONTACT_AWS_REGION)
    || normalizeString(env.AWS_REGION)
    || normalizeString(env.AWS_DEFAULT_REGION)
    || 'eu-west-1';

  return new SesContactMessageService({
    client: new SESv2Client({
      region
    }),
    toEmail,
    fromEmail
  });
}

function buildTextBody(input: ContactMessageInput): string {
  return [
    'New Daily Briefing contact form submission',
    '',
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Subject: ${input.subject}`,
    '',
    'Message:',
    input.message
  ].join('\n');
}

function normalizeString(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getPort(value: string | undefined): number {
  const parsedValue = Number.parseInt(value || '', 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 587;
}
