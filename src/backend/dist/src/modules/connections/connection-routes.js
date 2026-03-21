import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { ConnectionService } from './connection-service.js';
import { getGoogleCalendarOAuthClientFromEnvironment } from './google-calendar-oauth-client.js';
import { PrismaConnectionRepository } from './prisma-connection-repository.js';
export async function registerConnectionRoutes(app, dependencies = createConnectionRouteDependencies()) {
    const connectionService = dependencies.connectionService;
    const defaultUserService = dependencies.defaultUserService;
    const googleCalendarOAuthClient = dependencies.googleCalendarOAuthClient;
    app.get('/api/v1/connections', async function handleListConnections(request) {
        const query = request.query;
        const user = await defaultUserService.getDefaultUser();
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
            const user = await defaultUserService.getDefaultUser();
            const connection = await connectionService.create({
                tenantId: user.tenantId,
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
            const user = await defaultUserService.getDefaultUser();
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
        const user = await defaultUserService.getDefaultUser();
        const returnTo = googleCalendarOAuthClient.normalizeReturnTo(query.returnTo);
        const authorizationUrl = googleCalendarOAuthClient.createAuthorizationUrl({
            tenantId: user.tenantId,
            userId: user.userId,
            returnTo,
            connectionId: typeof query.connectionId === 'string' && query.connectionId.trim() ? query.connectionId.trim() : undefined,
            issuedAt: Date.now()
        });
        reply.redirect(authorizationUrl);
    });
    app.get('/api/v1/connections/google-calendar/oauth/callback', async function handleGoogleCalendarOAuthCallback(request, reply) {
        const query = request.query;
        let returnTo = googleCalendarOAuthClient.normalizeReturnTo();
        try {
            if (!query.state || typeof query.state !== 'string') {
                throw new Error('Google OAuth state is invalid.');
            }
            const state = googleCalendarOAuthClient.verifyState(query.state);
            returnTo = state.returnTo;
            if (query.error) {
                reply.redirect(returnTo);
                return;
            }
            if (!query.code || typeof query.code !== 'string' || !query.code.trim()) {
                throw new Error('Google OAuth authorization code is missing.');
            }
            const user = await defaultUserService.getDefaultUser();
            if (user.userId !== state.userId || user.tenantId !== state.tenantId) {
                throw new Error('Google OAuth state is invalid.');
            }
            const tokenSet = await googleCalendarOAuthClient.exchangeAuthorizationCode(query.code.trim());
            const account = await googleCalendarOAuthClient.getPrimaryCalendar(tokenSet.accessToken);
            const input = {
                tenantId: user.tenantId,
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
                await connectionService.update({
                    tenantId: user.tenantId,
                    connectionId: state.connectionId,
                    name: account.accountLabel || 'Google Calendar',
                    credentials: input.credentials
                });
            }
            else {
                await connectionService.create(input);
            }
            reply.redirect(returnTo);
        }
        catch {
            reply.redirect(returnTo);
        }
    });
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
                return value && value.trim() ? value : 'http://127.0.0.1:8080/';
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
