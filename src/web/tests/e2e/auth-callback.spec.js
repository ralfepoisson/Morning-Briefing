const { test, expect } = require('@playwright/test');

const TOKEN_KEY = 'morningBriefing.auth.token';
const SESSION_KEY = 'morningBriefing.auth.session';

test.describe('Life2 auth callback', () => {
  test('sign-in navigation uses applicationId and redirect query parameters', async ({ page }) => {
    await page.addInitScript(() => {
      window.__MORNING_BRIEFING_CONFIG__ = {
        authServiceSignInUrl: '/signIn?applicationToken=legacy-secret',
        authServiceApplicationId: 'morning-briefing-web',
        appBaseUrl: 'http://127.0.0.1:8080/'
      };
    });

    await page.goto('/#/signed-out');
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/signIn**');

    const signInUrl = new URL(page.url());

    expect(signInUrl.searchParams.get('applicationId')).toBe('morning-briefing-web');
    expect(signInUrl.searchParams.get('redirect')).toBe('http://127.0.0.1:8080/#/auth/callback');
    expect(signInUrl.searchParams.get('applicationToken')).toBeNull();
  });

  test('stores a valid Life2 token and completes the callback redirect', async ({ page }) => {
    const token = createToken({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'account-123',
      email: 'ralfepoisson@gmail.com',
      exp: futureExp()
    });

    await page.goto(`/#/auth/callback?token=${encodeURIComponent(token)}`);
    await page.waitForURL('**/#/dashboard');

    const storedToken = await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY);
    const storedSession = await page.evaluate((key) => window.localStorage.getItem(key), SESSION_KEY);

    expect(storedToken).toBe(token);
    expect(JSON.parse(storedSession)).toMatchObject({
      userid: 'ralfepoisson@gmail.com',
      accountId: 'account-123',
      email: 'ralfepoisson@gmail.com'
    });
  });

  test('rejects callback tokens without userid and clears stale stored auth state', async ({ page }) => {
    const staleToken = createToken({
      userid: 'stale@example.com',
      accountId: 'stale-account',
      exp: futureExp()
    });
    const badToken = createToken({
      username: 'cognito-user@example.com',
      sub: 'cognito-sub',
      exp: futureExp()
    });

    await page.addInitScript(([tokenKey, sessionKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
      window.localStorage.setItem(sessionKey, JSON.stringify({
        userid: 'stale@example.com',
        accountId: 'stale-account'
      }));
    }, [TOKEN_KEY, SESSION_KEY, staleToken]);

    await page.goto(`/#/auth/callback?token=${encodeURIComponent(badToken)}`);
    await page.waitForURL('**/#/signed-out');

    const storedToken = await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY);
    const storedSession = await page.evaluate((key) => window.localStorage.getItem(key), SESSION_KEY);
    const pageText = await page.textContent('body');

    expect(storedToken).toBeNull();
    expect(storedSession).toBeNull();
    expect(pageText).toContain('Authentication is required');
  });
});

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  return `${encodeSegment(header)}.${encodeSegment(payload)}.signature`;
}

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function futureExp() {
  return Math.floor(Date.now() / 1000) + 3600;
}
