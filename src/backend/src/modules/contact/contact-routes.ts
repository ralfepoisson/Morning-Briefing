import type { FastifyInstance } from 'fastify';
import {
  ContactMessageConfigurationError,
  createContactMessageServiceFromEnv,
  type ContactMessageInput,
  type ContactMessageService
} from './contact-message-service.js';

type ContactRouteDependencies = {
  contactMessageService?: ContactMessageService;
};

export async function registerContactRoutes(
  app: FastifyInstance,
  dependencies: ContactRouteDependencies = {}
) {
  const contactMessageService = dependencies.contactMessageService || createLazyContactMessageService();

  app.post('/api/v1/public/contact', async function handleContactRequest(request, reply) {
    const payload = normalizePayload(request.body);

    if (!isValidContactMessage(payload)) {
      reply.code(400);
      return {
        message: 'Please provide a valid name, email, subject, and message.'
      };
    }

    try {
      await contactMessageService.sendMessage(payload);
    } catch (error) {
      if (error instanceof ContactMessageConfigurationError) {
        reply.code(503);
        return {
          message: error.message
        };
      }

      request.log.error(error, 'Unable to send contact email');
      reply.code(500);
      return {
        message: 'We could not send your message right now. Please try again later.'
      };
    }

    reply.code(202);
    return {
      message: 'Your message has been sent.'
    };
  });
}

function createLazyContactMessageService(): ContactMessageService {
  let service: ContactMessageService | null = null;

  return {
    async sendMessage(input: ContactMessageInput): Promise<void> {
      if (!service) {
        service = createContactMessageServiceFromEnv();
      }

      await service.sendMessage(input);
    }
  };
}

function normalizePayload(value: unknown): ContactMessageInput {
  if (!value || typeof value !== 'object') {
    return emptyPayload();
  }

  const payload = value as Record<string, unknown>;

  return {
    name: normalizeString(payload.name),
    email: normalizeString(payload.email),
    subject: normalizeString(payload.subject),
    message: normalizeString(payload.message)
  };
}

function isValidContactMessage(input: ContactMessageInput): boolean {
  return input.name.length >= 2
    && input.subject.length >= 3
    && input.message.length >= 10
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function emptyPayload(): ContactMessageInput {
  return {
    name: '',
    email: '',
    subject: '',
    message: ''
  };
}
