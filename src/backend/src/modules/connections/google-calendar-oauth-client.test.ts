import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultFrontendBaseUrl,
  getDefaultGoogleOAuthRedirectUri
} from './google-calendar-oauth-client.js';

test('Google OAuth defaults to local URLs outside production', async function () {
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;

  try {
    assert.equal(getDefaultFrontendBaseUrl(), 'http://127.0.0.1:8080/');
    assert.equal(
      getDefaultGoogleOAuthRedirectUri(),
      'http://127.0.0.1:3000/api/v1/connections/google-calendar/oauth/callback'
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('Google OAuth defaults to the production app URL in production', async function () {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    assert.equal(getDefaultFrontendBaseUrl(), 'https://briefing.ralfepoisson.com/');
    assert.equal(
      getDefaultGoogleOAuthRedirectUri(),
      'https://briefing.ralfepoisson.com/api/v1/connections/google-calendar/oauth/callback'
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});
