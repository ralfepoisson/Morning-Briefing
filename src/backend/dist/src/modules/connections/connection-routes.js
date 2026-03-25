import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { logApplicationEvent } from '../admin/application-logger.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { ConnectionService } from './connection-service.js';
import { getDefaultFrontendBaseUrl, getGoogleCalendarOAuthClientFromEnvironment } from './google-calendar-oauth-client.js';
import { PrismaConnectionRepository } from './prisma-connection-repository.js';
export async function registerConnectionRoutes(app, dependencies = createConnectionRouteDependencies()) {
    const connectionService = dependencies.connectionService;
    const defaultUserService = dependencies.defaultUserService;
    const googleCalendarOAuthClient = dependencies.googleCalendarOAuthClient;
    app.get('/api/v1/connections', async function handleListConnections(request) {
        const query = request.query;
        const user = await defaultUserService.getDefaultUser(request);
        const items = await connectionService.listForTenant(user.tenantId, query.type);
        return {
            items: items
        };
    });
    app.post('/api/v1/connections', async function handleCreateConnection(request, reply) {
        const body = request.body;
        if (!body || typeof body.type !== 'string' || !body.type.trim()) {
            reply.code(400);
            return {
                message: 'Connection provider is required.'
            };
        }
        try {
            const user = await defaultUserService.getDefaultUser(request);
            const connection = await connectionService.create({
                tenantId: user.tenantId,
                ownerUserId: user.userId,
                type: body.type.trim(),
                credentials: body.credentials || {}
            });
            reply.code(201);
            return connection;
        }
        catch (error) {
            if (error instanceof Error &&
                (error.message === 'Connection provider is not supported.' ||
                    error.message === 'Todoist API key is required.' ||
                    error.message === 'OpenAI API key is required.' ||
                    error.message === 'Google Calendar access token is required.' ||
                    error.message === 'Google Calendar refresh token is required.' ||
                    error.message === 'Google Calendar calendar id is required.')) {
                reply.code(400);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
    app.patch('/api/v1/connections/:connectionId', async function handleUpdateConnection(request, reply) {
        const params = request.params;
        const body = request.body;
        if (!params.connectionId || !params.connectionId.trim()) {
            reply.code(400);
            return {
                message: 'Connection id is required.'
            };
        }
        try {
            const user = await defaultUserService.getDefaultUser(request);
            const connection = await connectionService.update({
                tenantId: user.tenantId,
                connectionId: params.connectionId.trim(),
                name: body && typeof body.name === 'string' ? body.name : undefined,
                credentials: body && body.credentials ? body.credentials : {}
            });
            return connection;
        }
        catch (error) {
            if (error instanceof Error &&
                (error.message === 'Connection was not found.' ||
                    error.message === 'Connection provider is not supported.' ||
                    error.message === 'Connection name is required.' ||
                    error.message === 'Todoist API key is required.' ||
                    error.message === 'OpenAI API key is required.' ||
                    error.message === 'Google Calendar refresh token is required.' ||
                    error.message === 'Google Calendar calendar id is required.')) {
                reply.code(error.message === 'Connection was not found.' ? 404 : 400);
                return {
                    message: error.message
                };
            }
            throw error;
        }
    });
    app.get('/api/v1/connections/google-calendar/oauth/start', async function handleStartGoogleCalendarOAuth(request, reply) {
        const query = request.query;
        const authorizationUrl = await buildGoogleCalendarAuthorizationUrl(request, query, defaultUserService, googleCalendarOAuthClient);
        reply.redirect(authorizationUrl);
    });
    app.post('/api/v1/connections/google-calendar/oauth/start', async function handleStartGoogleCalendarOAuthApi(request) {
        const body = request.body;
        const authorizationUrl = await buildGoogleCalendarAuthorizationUrl(request, body || {}, defaultUserService, googleCalendarOAuthClient);
        return {
            authorizationUrl
        };
    });
    app.get('/api/v1/connections/google-calendar/oauth/callback', async function handleGoogleCalendarOAuthCallback(request, reply) {
        const query = request.query;
        let returnTo = googleCalendarOAuthClient.normalizeReturnTo();
        let resolvedConnectionId = null;
        try {
            if (!query.state || typeof query.state !== 'string') {
                throw new Error('Google OAuth state is invalid.');
            }
            const state = googleCalendarOAuthClient.verifyState(query.state);
            returnTo = state.returnTo;
            if (query.error) {
                logApplicationEvent({
                    level: 'warn',
                    scope: 'connections',
                    event: 'google_calendar_oauth_denied',
                    message: 'Google Calendar OAuth was cancelled or denied.',
                    context: {
                        tenantId: state.tenantId,
                        userId: state.userId,
                        connectionId: state.connectionId || null,
                        error: query.error
                    }
                });
                reply.redirect(returnTo);
                return;
            }
            if (!query.code || typeof query.code !== 'string' || !query.code.trim()) {
                throw new Error('Google OAuth authorization code is missing.');
            }
            const tokenSet = await googleCalendarOAuthClient.exchangeAuthorizationCode(query.code.trim());
            const account = await googleCalendarOAuthClient.getPrimaryCalendar(tokenSet.accessToken);
            const input = {
                tenantId: state.tenantId,
                ownerUserId: state.userId,
                type: 'google-calendar',
                credentials: {
                    accessToken: tokenSet.accessToken,
                    refreshToken: tokenSet.refreshToken,
                    expiresAt: tokenSet.expiresAt,
                    scope: tokenSet.scope,
                    tokenType: tokenSet.tokenType,
                    calendarId: account.calendarId || 'primary',
                    accountEmail: account.accountEmail,
                    accountLabel: account.accountLabel,
                    timezone: account.timezone
                }
            };
            if (state.connectionId) {
                const updatedConnection = await connectionService.update({
                    tenantId: state.tenantId,
                    connectionId: state.connectionId,
                    ownerUserId: state.userId,
                    name: account.accountLabel || 'Google Calendar',
                    credentials: input.credentials
                });
                resolvedConnectionId = updatedConnection.id;
            }
            else {
                const createdConnection = await connectionService.create(input);
                resolvedConnectionId = createdConnection.id;
            }
            logApplicationEvent({
                level: 'info',
                scope: 'connections',
                event: 'google_calendar_oauth_saved',
                message: 'Google Calendar OAuth connection saved.',
                context: {
                    tenantId: state.tenantId,
                    userId: state.userId,
                    connectionId: state.connectionId || null,
                    calendarId: input.credentials.calendarId,
                    accountEmail: input.credentials.accountEmail || null
                }
            });
            reply.redirect(appendOAuthResultToReturnTo(returnTo, resolvedConnectionId, input.type));
        }
        catch (error) {
            logApplicationEvent({
                level: 'error',
                scope: 'connections',
                event: 'google_calendar_oauth_callback_failed',
                message: 'Google Calendar OAuth callback failed.',
                context: {
                    error: error instanceof Error ? error.message : String(error),
                    codePresent: typeof query.code === 'string' && !!query.code.trim(),
                    errorParam: typeof query.error === 'string' ? query.error : null,
                    returnTo
                }
            });
            reply.redirect(returnTo);
        }
    });
}
function appendOAuthResultToReturnTo(returnTo, connectionId, provider) {
    if (!connectionId) {
        return returnTo;
    }
    try {
        const targetUrl = new URL(returnTo);
        targetUrl.searchParams.set('oauthConnectionId', connectionId);
        targetUrl.searchParams.set('oauthProvider', provider);
        return targetUrl.toString();
    }
    catch {
        return returnTo;
    }
}
function createConnectionRouteDependencies() {
    const prisma = getPrismaClient();
    let googleCalendarOAuthClient;
    try {
        googleCalendarOAuthClient = getGoogleCalendarOAuthClientFromEnvironment();
    }
    catch {
        googleCalendarOAuthClient = {
            createAuthorizationUrl() {
                throw new Error('Google OAuth is not configured.');
            },
            async exchangeAuthorizationCode() {
                throw new Error('Google OAuth is not configured.');
            },
            async getPrimaryCalendar() {
                throw new Error('Google OAuth is not configured.');
            },
            normalizeReturnTo(value) {
                return value && value.trim() ? value : getDefaultFrontendBaseUrl();
            },
            verifyState() {
                throw new Error('Google OAuth is not configured.');
            }
        };
    }
    return {
        connectionService: new ConnectionService(new PrismaConnectionRepository(prisma)),
        defaultUserService: new DefaultUserService(prisma),
        googleCalendarOAuthClient
    };
}
async function buildGoogleCalendarAuthorizationUrl(request, input, defaultUserService, googleCalendarOAuthClient) {
    const user = await defaultUserService.getDefaultUser(request);
    const returnTo = googleCalendarOAuthClient.normalizeReturnTo(input.returnTo);
    return googleCalendarOAuthClient.createAuthorizationUrl({
        tenantId: user.tenantId,
        userId: user.userId,
        returnTo,
        connectionId: typeof input.connectionId === 'string' && input.connectionId.trim() ? input.connectionId.trim() : undefined,
        issuedAt: Date.now()
    });
}
