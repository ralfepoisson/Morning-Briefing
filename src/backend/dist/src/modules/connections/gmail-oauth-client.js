import { createHmac, timingSafeEqual } from 'node:crypto';
import { describeFetchFailure } from '../../shared/fetch-error.js';
const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export class GmailOAuthClient {
    config;
    constructor(config) {
        this.config = config;
    }
    createAuthorizationUrl(state) {
        const url = new URL(GOOGLE_AUTH_BASE_URL);
        url.searchParams.set('client_id', this.config.clientId);
        url.searchParams.set('redirect_uri', this.config.redirectUri);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', GMAIL_READONLY_SCOPE);
        url.searchParams.set('access_type', 'offline');
        url.searchParams.set('prompt', 'consent');
        url.searchParams.set('state', this.signState(state));
        return url.toString();
    }
    async exchangeAuthorizationCode(code) {
        let response;
        try {
            response = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    code,
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    redirect_uri: this.config.redirectUri,
                    grant_type: 'authorization_code'
                })
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('Google OAuth token exchange', GOOGLE_TOKEN_URL, error));
        }
        if (!response.ok) {
            throw new Error('Google OAuth token exchange failed.');
        }
        const payload = await response.json();
        const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
        const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : '';
        const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 0;
        if (!accessToken || !refreshToken || !expiresIn) {
            throw new Error('Google OAuth token response was incomplete.');
        }
        return {
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
            scope: typeof payload.scope === 'string' ? payload.scope : GMAIL_READONLY_SCOPE,
            tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer'
        };
    }
    async refreshAccessToken(refreshToken) {
        let response;
        try {
            response = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    refresh_token: refreshToken,
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    grant_type: 'refresh_token'
                })
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('Google OAuth token refresh', GOOGLE_TOKEN_URL, error));
        }
        if (!response.ok) {
            throw new Error('Google OAuth token refresh failed.');
        }
        const payload = await response.json();
        const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
        const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 0;
        if (!accessToken || !expiresIn) {
            throw new Error('Google OAuth refresh response was incomplete.');
        }
        return {
            accessToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
            scope: typeof payload.scope === 'string' ? payload.scope : GMAIL_READONLY_SCOPE,
            tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer'
        };
    }
    async getAccount(accessToken) {
        let response;
        try {
            response = await fetch(GMAIL_PROFILE_URL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
        }
        catch (error) {
            throw new Error(describeFetchFailure('Gmail account lookup', GMAIL_PROFILE_URL, error));
        }
        if (!response.ok) {
            throw new Error('Gmail account lookup failed.');
        }
        const payload = await response.json();
        const accountEmail = typeof payload.emailAddress === 'string' ? payload.emailAddress.trim() : '';
        if (!accountEmail) {
            throw new Error('Gmail account lookup returned an incomplete profile.');
        }
        return {
            accountEmail,
            accountLabel: accountEmail
        };
    }
    normalizeReturnTo(value) {
        const fallback = new URL('/', this.config.frontendBaseUrl).toString();
        if (!value || !value.trim()) {
            return fallback;
        }
        try {
            const parsed = new URL(value);
            const frontend = new URL(this.config.frontendBaseUrl);
            if (parsed.origin !== frontend.origin) {
                return fallback;
            }
            return parsed.toString();
        }
        catch {
            return fallback;
        }
    }
    signState(state) {
        const payload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
        const signature = createHmac('sha256', this.config.stateSecret).update(payload).digest('base64url');
        return `${payload}.${signature}`;
    }
    verifyState(serialized) {
        const parts = serialized.split('.');
        if (parts.length !== 2) {
            throw new Error('Google OAuth state is invalid.');
        }
        const payload = parts[0];
        const expectedSignature = createHmac('sha256', this.config.stateSecret).update(payload).digest('base64url');
        const actualBuffer = Buffer.from(parts[1]);
        const expectedBuffer = Buffer.from(expectedSignature);
        if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
            throw new Error('Google OAuth state is invalid.');
        }
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!parsed || !parsed.userId || !parsed.tenantId || !parsed.returnTo || !parsed.issuedAt) {
            throw new Error('Google OAuth state is invalid.');
        }
        return {
            ...parsed,
            returnTo: this.normalizeReturnTo(parsed.returnTo)
        };
    }
}
export function getGmailOAuthClientFromEnvironment() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || getDefaultFrontendBaseUrl();
    const redirectUri = process.env.GOOGLE_GMAIL_OAUTH_REDIRECT_URI || getDefaultGmailOAuthRedirectUri();
    const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || clientSecret;
    if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
        throw new Error('Google OAuth is not configured.');
    }
    return new GmailOAuthClient({
        clientId,
        clientSecret,
        redirectUri,
        frontendBaseUrl,
        stateSecret
    });
}
export function getDefaultFrontendBaseUrl() {
    return process.env.NODE_ENV === 'production'
        ? 'https://briefing.ralfepoisson.com/'
        : 'http://127.0.0.1:8080/';
}
export function getDefaultGmailOAuthRedirectUri(frontendBaseUrl) {
    const baseUrl = frontendBaseUrl || (process.env.NODE_ENV === 'production'
        ? 'https://briefing.ralfepoisson.com/'
        : 'http://127.0.0.1:3000/');
    return new URL('/api/v1/connections/gmail/oauth/callback', baseUrl).toString();
}
