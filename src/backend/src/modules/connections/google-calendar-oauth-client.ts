import { createHmac, timingSafeEqual } from 'node:crypto';
import { describeFetchFailure } from '../../shared/fetch-error.js';

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export type GoogleCalendarOAuthState = {
  tenantId: string;
  userId: string;
  returnTo: string;
  connectionId?: string;
  issuedAt: number;
};

export type GoogleCalendarTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  tokenType: string;
};

export type GoogleCalendarAccount = {
  calendarId: string;
  accountEmail: string;
  accountLabel: string;
  timezone: string;
};

export class GoogleCalendarOAuthClient {
  constructor(
    private readonly config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      frontendBaseUrl: string;
      stateSecret: string;
    }
  ) {}

  createAuthorizationUrl(state: GoogleCalendarOAuthState): string {
    const url = new URL(GOOGLE_AUTH_BASE_URL);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_CALENDAR_READONLY_SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', this.signState(state));

    return url.toString();
  }

  async exchangeAuthorizationCode(code: string): Promise<GoogleCalendarTokenSet> {
    let response: Response;

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
    } catch (error) {
      throw new Error(describeFetchFailure('Google OAuth token exchange', GOOGLE_TOKEN_URL, error));
    }

    if (!response.ok) {
      throw new Error('Google OAuth token exchange failed.');
    }

    const payload = await response.json() as Record<string, unknown>;
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
      scope: typeof payload.scope === 'string' ? payload.scope : GOOGLE_CALENDAR_READONLY_SCOPE,
      tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer'
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<Pick<GoogleCalendarTokenSet, 'accessToken' | 'expiresAt' | 'scope' | 'tokenType'>> {
    let response: Response;

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
    } catch (error) {
      throw new Error(describeFetchFailure('Google OAuth token refresh', GOOGLE_TOKEN_URL, error));
    }

    if (!response.ok) {
      throw new Error('Google OAuth token refresh failed.');
    }

    const payload = await response.json() as Record<string, unknown>;
    const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
    const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 0;

    if (!accessToken || !expiresIn) {
      throw new Error('Google OAuth refresh response was incomplete.');
    }

    return {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope: typeof payload.scope === 'string' ? payload.scope : GOOGLE_CALENDAR_READONLY_SCOPE,
      tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer'
    };
  }

  async getPrimaryCalendar(accessToken: string): Promise<GoogleCalendarAccount> {
    const url = `${GOOGLE_CALENDAR_BASE_URL}/users/me/calendarList/primary`;
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    } catch (error) {
      throw new Error(describeFetchFailure('Google Calendar account lookup', url, error));
    }

    if (!response.ok) {
      throw new Error('Google Calendar account lookup failed.');
    }

    const payload = await response.json() as Record<string, unknown>;
    const calendarId = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : 'primary';

    return {
      calendarId,
      accountEmail: typeof payload.id === 'string' ? payload.id : '',
      accountLabel: typeof payload.summary === 'string' ? payload.summary : 'Google Calendar',
      timezone: typeof payload.timeZone === 'string' ? payload.timeZone : ''
    };
  }

  normalizeReturnTo(value?: string): string {
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
    } catch {
      return fallback;
    }
  }

  signState(state: GoogleCalendarOAuthState): string {
    const payload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.config.stateSecret).update(payload).digest('base64url');

    return `${payload}.${signature}`;
  }

  verifyState(serialized: string): GoogleCalendarOAuthState {
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

    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GoogleCalendarOAuthState;

    if (!parsed || !parsed.userId || !parsed.tenantId || !parsed.returnTo || !parsed.issuedAt) {
      throw new Error('Google OAuth state is invalid.');
    }

    return {
      ...parsed,
      returnTo: this.normalizeReturnTo(parsed.returnTo)
    };
  }
}

export function getGoogleCalendarOAuthClientFromEnvironment(): GoogleCalendarOAuthClient {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || getDefaultFrontendBaseUrl();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || getDefaultGoogleOAuthRedirectUri();
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || clientSecret;

  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    throw new Error('Google OAuth is not configured.');
  }

  return new GoogleCalendarOAuthClient({
    clientId,
    clientSecret,
    redirectUri,
    frontendBaseUrl,
    stateSecret
  });
}

export function getDefaultFrontendBaseUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? 'https://briefing.ralfepoisson.com/'
    : 'http://127.0.0.1:8080/';
}

export function getDefaultGoogleOAuthRedirectUri(frontendBaseUrl?: string): string {
  const baseUrl = frontendBaseUrl || (
    process.env.NODE_ENV === 'production'
      ? 'https://briefing.ralfepoisson.com/'
      : 'http://127.0.0.1:3000/'
  );

  return new URL('/api/v1/connections/google-calendar/oauth/callback', baseUrl).toString();
}
