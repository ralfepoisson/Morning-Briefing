import { ContactMessageConfigurationError, createContactMessageServiceFromEnv } from './contact-message-service.js';
export async function registerContactRoutes(app, dependencies = {}) {
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
        }
        catch (error) {
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
function createLazyContactMessageService() {
    let service = null;
    return {
        async sendMessage(input) {
            if (!service) {
                service = createContactMessageServiceFromEnv();
            }
            await service.sendMessage(input);
        }
    };
}
function normalizePayload(value) {
    if (!value || typeof value !== 'object') {
        return emptyPayload();
    }
    const payload = value;
    return {
        name: normalizeString(payload.name),
        email: normalizeString(payload.email),
        subject: normalizeString(payload.subject),
        message: normalizeString(payload.message)
    };
}
function isValidContactMessage(input) {
    return input.name.length >= 2
        && input.subject.length >= 3
        && input.message.length >= 10
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
}
function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function emptyPayload() {
    return {
        name: '',
        email: '',
        subject: '',
        message: ''
    };
}
