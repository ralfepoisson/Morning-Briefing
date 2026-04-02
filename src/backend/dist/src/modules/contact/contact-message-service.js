import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
export class ContactMessageConfigurationError extends Error {
}
export class SesContactMessageService {
    config;
    constructor(config) {
        this.config = config;
    }
    async sendMessage(input) {
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
export class SmtpContactMessageService {
    config;
    transporter;
    constructor(config) {
        this.config = config;
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
    async sendMessage(input) {
        await this.transporter.sendMail({
            to: this.config.toEmail,
            from: this.config.fromEmail,
            replyTo: input.email,
            subject: `[Daily Briefing Contact] ${input.subject}`,
            text: buildTextBody(input)
        });
    }
}
export function createContactMessageServiceFromEnv(env = process.env) {
    const provider = normalizeString(env.CONTACT_DELIVERY_PROVIDER).toLowerCase();
    const fromEmail = normalizeString(env.CONTACT_FROM_EMAIL);
    const toEmail = normalizeString(env.CONTACT_TO_EMAIL) || 'ralfepoisson@gmail.com';
    const host = normalizeString(env.CONTACT_SMTP_HOST);
    const user = normalizeString(env.CONTACT_SMTP_USER);
    const pass = normalizeString(env.CONTACT_SMTP_PASS);
    if (!fromEmail) {
        throw new ContactMessageConfigurationError('Contact form email delivery is not configured. Set CONTACT_FROM_EMAIL and either configure SES or provide SMTP credentials.');
    }
    if (provider === 'smtp' || (host && user && pass)) {
        if (!host || !user || !pass) {
            throw new ContactMessageConfigurationError('SMTP contact delivery requires CONTACT_SMTP_HOST, CONTACT_SMTP_USER, CONTACT_SMTP_PASS, and CONTACT_FROM_EMAIL.');
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
function buildTextBody(input) {
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
function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function getPort(value) {
    const parsedValue = Number.parseInt(value || '', 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 587;
}
