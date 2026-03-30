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
  const host = normalizeString(env.CONTACT_SMTP_HOST);
  const user = normalizeString(env.CONTACT_SMTP_USER);
  const pass = normalizeString(env.CONTACT_SMTP_PASS);
  const fromEmail = normalizeString(env.CONTACT_FROM_EMAIL);

  if (!host || !user || !pass || !fromEmail) {
    throw new ContactMessageConfigurationError(
      'Contact form email delivery is not configured. Set CONTACT_SMTP_HOST, CONTACT_SMTP_USER, CONTACT_SMTP_PASS, and CONTACT_FROM_EMAIL.'
    );
  }

  return new SmtpContactMessageService({
    host,
    port: getPort(env.CONTACT_SMTP_PORT),
    secure: env.CONTACT_SMTP_SECURE === 'true',
    user,
    pass,
    toEmail: normalizeString(env.CONTACT_TO_EMAIL) || 'ralfepoisson@gmail.com',
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
