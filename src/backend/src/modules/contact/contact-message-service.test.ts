import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContactMessageConfigurationError,
  SesContactMessageService,
  SmtpContactMessageService,
  createContactMessageServiceFromEnv
} from './contact-message-service.js';

test('createContactMessageServiceFromEnv defaults to SES when CONTACT_FROM_EMAIL is configured', function () {
  const service = createContactMessageServiceFromEnv({
    CONTACT_FROM_EMAIL: 'no-reply@ralfepoisson.com',
    CONTACT_TO_EMAIL: 'ralfepoisson@gmail.com',
    AWS_REGION: 'eu-west-1'
  });

  assert.equal(service instanceof SesContactMessageService, true);
});

test('createContactMessageServiceFromEnv uses SMTP when requested explicitly', function () {
  const service = createContactMessageServiceFromEnv({
    CONTACT_DELIVERY_PROVIDER: 'smtp',
    CONTACT_FROM_EMAIL: 'no-reply@example.com',
    CONTACT_SMTP_HOST: 'smtp.example.com',
    CONTACT_SMTP_PORT: '587',
    CONTACT_SMTP_SECURE: 'false',
    CONTACT_SMTP_USER: 'smtp-user',
    CONTACT_SMTP_PASS: 'smtp-pass'
  });

  assert.equal(service instanceof SmtpContactMessageService, true);
});

test('createContactMessageServiceFromEnv rejects missing CONTACT_FROM_EMAIL', function () {
  assert.throws(function shouldThrow() {
    createContactMessageServiceFromEnv({
      AWS_REGION: 'eu-west-1'
    });
  }, ContactMessageConfigurationError);
});

test('SesContactMessageService sends the contact message through SES', async function () {
  const sentCommands: Array<Record<string, unknown>> = [];
  const service = new SesContactMessageService({
    client: {
      async send(command) {
        sentCommands.push(command.input as Record<string, unknown>);
        return {};
      }
    },
    toEmail: 'ralfepoisson@gmail.com',
    fromEmail: 'no-reply@ralfepoisson.com'
  });

  await service.sendMessage({
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Hello',
    message: 'I would like to know more about Daily Briefing.'
  });

  assert.deepEqual(sentCommands, [
    {
      FromEmailAddress: 'no-reply@ralfepoisson.com',
      Destination: {
        ToAddresses: ['ralfepoisson@gmail.com']
      },
      ReplyToAddresses: ['jane@example.com'],
      Content: {
        Simple: {
          Subject: {
            Data: '[Daily Briefing Contact] Hello'
          },
          Body: {
            Text: {
              Data: [
                'New Daily Briefing contact form submission',
                '',
                'Name: Jane Doe',
                'Email: jane@example.com',
                'Subject: Hello',
                '',
                'Message:',
                'I would like to know more about Daily Briefing.'
              ].join('\n')
            }
          }
        }
      }
    }
  ]);
});
