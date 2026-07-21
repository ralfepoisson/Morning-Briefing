export interface Session {
  userid: string;
  accountId: string;
  displayName: string;
  email: string;
  exp: number | null;
  rawClaims: Record<string, unknown>;
}

export interface SignInConfig {
  signInUrl: string;
  applicationId: string;
  appBaseUrl: string;
}

export function parseToken(token: string): Session {
  const segments = token.split('.');
  if (segments.length < 2 || !segments[1]) {
    throw new Error('The returned authentication token is malformed.');
  }

  const payload = JSON.parse(decodeBase64Url(segments[1])) as Record<string, unknown>;
  const userid = firstString(payload.userid, payload.userId, payload.sub);
  const accountId = firstString(payload.accountId, payload.accountid, payload.tenantId, payload.tenantid);
  if (!userid) {
    throw new Error('The authentication token is missing a userid claim.');
  }
  if (!accountId) {
    throw new Error('The authentication token is missing an accountId claim.');
  }
  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp && exp * 1000 <= Date.now()) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  return {
    userid,
    accountId,
    displayName: firstString(payload.displayName, payload.name, payload.email) || userid,
    email: firstString(payload.email),
    exp,
    rawClaims: payload
  };
}

export function buildSignInUrl(config: SignInConfig, origin: string): string {
  const url = new URL(config.signInUrl, origin);
  url.searchParams.delete('applicationToken');
  url.searchParams.set('applicationId', config.applicationId);
  url.searchParams.set('redirect', `${config.appBaseUrl.replace(/\/+$/, '')}/#/auth/callback`);
  return url.toString();
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if ((typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}
