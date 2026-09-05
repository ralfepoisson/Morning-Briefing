const { test, expect } = require('./playwright-fixtures');
const { createHmac } = require('node:crypto');
const TOKEN_KEY = 'morningBriefing.auth.token';

function signedToken(key) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode({alg:'HS256',typ:'JWT'})}.${encode({userid:'auth-regression-user',accountId:'auth-regression-account',exp:Math.floor(Date.now()/1000)+300})}`;
  return `${input}.${createHmac('sha256',key).update(input).digest('base64url')}`;
}

test('real backend signature rejection clears the session and leaves a working sign-in page', async ({page}) => {
  test.skip(!process.env.LIFE2_JWT_SECRET, 'Requires signature verification on the test backend.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const token = signedToken('intentionally-wrong-test-signing-key');
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/v1/dashboards'));
  await page.goto(`/?token=${encodeURIComponent(token)}#/dashboard`);
  expect((await rejected).status()).toBe(401);
  await expect(page.getByRole('heading', {name:'Authentication is required'})).toBeVisible();
  await expect(page.getByText('Loading dashboard…')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Sign out',exact:true})).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('morningBriefing.auth.token'))).toBeNull();
  expect(page.url()).not.toContain('token=');
  const logo = page.getByRole('img', {name:'Morning Briefing logo'});
  await expect(logo).toBeVisible();
  expect(await logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});

for (const callback of ['/?token=TOKEN#/dashboard','/#/auth/callback?token=TOKEN']) {
  test(`real backend accepts a correctly signed callback: ${callback}`, async ({page}) => {
    test.skip(!process.env.LIFE2_JWT_SECRET, 'Requires the configured test signing key.');
    const token = signedToken(process.env.LIFE2_JWT_SECRET);
    const loaded = page.waitForResponse(response => response.url().endsWith('/api/v1/dashboards'));
    await page.goto(callback.replace('TOKEN',encodeURIComponent(token)));
    expect((await loaded).status()).toBe(200);
    await expect(page.getByRole('heading', {name:'No dashboards yet'})).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key),TOKEN_KEY)).toBe(token);
    expect(page.url()).not.toContain('token=');
  });
}
