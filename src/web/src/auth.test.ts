import { describe, expect, it } from 'vitest';
import { buildSignInUrl, parseToken } from './auth.ts';

describe('Life2 authentication contract', function () {
  it('accepts the supported user and account claim aliases', function () {
    const token = createToken({
      userId: 42,
      tenantId: 'tenant-1',
      email: 'user@example.test',
      exp: Math.floor(Date.now() / 1000) + 60
    });

    expect(parseToken(token)).toMatchObject({
      userid: '42',
      accountId: 'tenant-1',
      email: 'user@example.test'
    });
  });

  it('rejects tokens without both application identity claims', function () {
    expect(function () {
      parseToken(createToken({ sub: 'user-only' }));
    }).toThrow(/accountId/);
  });

  it('uses the public application id and removes the legacy application token', function () {
    const url = new URL(buildSignInUrl({
      signInUrl: '/signIn?applicationToken=legacy-secret',
      applicationId: 'public-id',
      appBaseUrl: 'https://briefing.example.test/'
    }, 'https://briefing.example.test'));

    expect(url.searchParams.get('applicationId')).toBe('public-id');
    expect(url.searchParams.get('applicationToken')).toBeNull();
    expect(url.searchParams.get('redirect')).toBe('https://briefing.example.test/#/auth/callback');
  });
});

function createToken(payload: Record<string, unknown>): string {
  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode(payload),
    'signature'
  ].join('.');
}

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
