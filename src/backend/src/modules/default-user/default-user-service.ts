import { createHash, createHmac, createPublicKey, createVerify } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

const DEFAULT_TENANT_SLUG = 'ralfe-local';
const DEFAULT_USER_EMAIL = 'ralfe@example.com';
const LIFE2_TENANT_NAMESPACE = 'life2-tenant';
const LIFE2_USER_NAMESPACE = 'life2-user';

export type DefaultUserContext = {
  tenantId: string;
  userId: string;
  displayName: string;
  timezone: string;
  locale: string;
  email: string;
  isAdmin: boolean;
};

type Life2JwtPayload = {
  userid?: unknown;
  userId?: unknown;
  sub?: unknown;
  accountId?: unknown;
  accountid?: unknown;
  tenantId?: unknown;
  tenantid?: unknown;
  email?: unknown;
  displayName?: unknown;
  name?: unknown;
  preferred_username?: unknown;
  timezone?: unknown;
  locale?: unknown;
  exp?: unknown;
  nbf?: unknown;
};

export class DefaultUserService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDefaultUser(request?: FastifyRequest): Promise<DefaultUserContext> {
    const life2User = await this.getLife2User(request);

    if (life2User) {
      return life2User;
    }

    return this.getLocalDefaultUser();
  }

  private async getLife2User(request?: FastifyRequest): Promise<DefaultUserContext | null> {
    const token = readBearerToken(request);
    let payload: Life2JwtPayload;
    let tenantId: string;
    let userId: string;
    let displayName: string;
    let timezone: string;
    let locale: string;
    let email: string;

    if (!token) {
      return null;
    }

    payload = verifyAndDecodeLife2Token(token);

    const normalizedUserId = firstNonEmptyClaim([payload.userid, payload.userId, payload.sub]);
    const normalizedAccountId = firstNonEmptyClaim([payload.accountId, payload.accountid, payload.tenantId, payload.tenantid]);

    if (!normalizedUserId) {
      throw new UnauthorizedError('Life2 token is missing the userid claim.');
    }

    if (!normalizedAccountId) {
      throw new UnauthorizedError('Life2 token is missing the accountId claim.');
    }

    tenantId = deterministicUuid(LIFE2_TENANT_NAMESPACE + ':' + normalizedAccountId);
    userId = deterministicUuid(LIFE2_USER_NAMESPACE + ':' + normalizedUserId);
    displayName = coalesceString(payload.displayName, payload.name, payload.preferred_username, payload.email, normalizedUserId, 'Life2 User');
    timezone = coalesceString(payload.timezone, 'UTC');
    locale = coalesceString(payload.locale, 'en-GB');
    email = coalesceString(payload.email, userId + '@life2.local');

    await this.prisma.tenant.upsert({
      where: {
        id: tenantId
      },
      update: {
        name: coalesceString(normalizedAccountId, 'Life2 Account'),
        slug: 'life2-' + tenantId.slice(0, 12),
        status: 'ACTIVE'
      },
      create: {
        id: tenantId,
        name: coalesceString(normalizedAccountId, 'Life2 Account'),
        slug: 'life2-' + tenantId.slice(0, 12)
      }
    });

    const user = await this.upsertAppUser({
      id: userId,
      tenantId,
      email,
      displayName,
      timezone,
      locale
    });

    return {
      tenantId,
      userId,
      displayName,
      timezone,
      locale,
      email,
      isAdmin: user.isAdmin
    };
  }

  private async getLocalDefaultUser(): Promise<DefaultUserContext> {
    const tenant = await this.prisma.tenant.upsert({
      where: {
        slug: DEFAULT_TENANT_SLUG
      },
      update: {
        name: 'Ralfe Local',
        status: 'ACTIVE'
      },
      create: {
        name: 'Ralfe Local',
        slug: DEFAULT_TENANT_SLUG
      }
    });

    const user = await this.upsertAppUser({
      id: null,
      tenantId: tenant.id,
      email: DEFAULT_USER_EMAIL,
      displayName: 'Ralfe',
      timezone: 'Europe/Paris',
      locale: 'en-GB'
    });

    return {
      tenantId: tenant.id,
      userId: user.id,
      displayName: user.displayName,
      timezone: user.timezone,
      locale: user.locale,
      email: user.email,
      isAdmin: user.isAdmin
    };
  }

  private async upsertAppUser(input: {
    id: string | null;
    tenantId: string;
    email: string;
    displayName: string;
    timezone: string;
    locale: string;
  }) {
    const existingUser = input.id
      ? await this.prisma.appUser.findUnique({
        where: {
          id: input.id
        }
      })
      : await this.prisma.appUser.findUnique({
        where: {
          tenantId_email: {
            tenantId: input.tenantId,
            email: input.email
          }
        }
      });

    if (existingUser) {
      const shouldGrantBootstrapAdminAccess = !existingUser.isAdmin && await this.shouldGrantBootstrapAdminAccess(input.tenantId);

      return this.prisma.appUser.update({
        where: {
          id: existingUser.id
        },
        data: {
          tenantId: input.tenantId,
          email: input.email,
          displayName: input.displayName,
          timezone: input.timezone,
          locale: input.locale,
          isAdmin: shouldGrantBootstrapAdminAccess ? true : existingUser.isAdmin,
          isActive: true
        }
      });
    }

    return this.prisma.appUser.create({
      data: {
        id: input.id || undefined,
        tenantId: input.tenantId,
        email: input.email,
        displayName: input.displayName,
        timezone: input.timezone,
        locale: input.locale,
        isAdmin: await this.shouldGrantBootstrapAdminAccess(input.tenantId)
      }
    });
  }

  private async shouldGrantBootstrapAdminAccess(tenantId: string): Promise<boolean> {
    const adminCount = await this.prisma.appUser.count({
      where: {
        tenantId,
        isAdmin: true
      }
    });

    return adminCount === 0;
  }
}

export function assertAuthenticatedRequest(request?: FastifyRequest): void {
  const token = readBearerToken(request);

  if (!token) {
    throw new UnauthorizedError('Authorization header is required.');
  }

  verifyAndDecodeLife2Token(token);
}

function readBearerToken(request?: FastifyRequest): string | null {
  const authorizationHeader = request && request.headers ? request.headers.authorization : null;
  const match = typeof authorizationHeader === 'string' ? authorizationHeader.match(/^Bearer\s+(.+)$/i) : null;

  if (!authorizationHeader) {
    return null;
  }

  if (!match || !match[1]) {
    throw new UnauthorizedError('Authorization header must use the Bearer scheme.');
  }

  return match[1].trim();
}

function verifyAndDecodeLife2Token(token: string): Life2JwtPayload {
  const segments = token.split('.');
  let header: { alg?: unknown };
  let payload: Life2JwtPayload;

  if (segments.length !== 3) {
    throw new UnauthorizedError('Life2 token is malformed.');
  }

  header = decodeJwtSegment<{ alg?: unknown }>(segments[0], 'header');
  payload = decodeJwtSegment<Life2JwtPayload>(segments[1], 'payload');

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    throw new UnauthorizedError('Life2 token has expired.');
  }

  if (typeof payload.nbf === 'number' && payload.nbf * 1000 > Date.now()) {
    throw new UnauthorizedError('Life2 token is not valid yet.');
  }

  verifySignatureIfConfigured(typeof header.alg === 'string' ? header.alg : '', segments[0] + '.' + segments[1], segments[2]);

  return payload;
}

function verifySignatureIfConfigured(algorithm: string, signingInput: string, signature: string): void {
  const sharedSecret = process.env.LIFE2_JWT_SECRET;
  const publicKey = process.env.LIFE2_JWT_PUBLIC_KEY;

  if (!sharedSecret && !publicKey) {
    return;
  }

  if (!algorithm || algorithm === 'none') {
    throw new UnauthorizedError('Unsigned Life2 tokens are not allowed.');
  }

  if (sharedSecret) {
    if (algorithm !== 'HS256') {
      throw new UnauthorizedError('Life2 token algorithm is not supported by the configured shared secret.');
    }

    if (createHmac('sha256', sharedSecret).update(signingInput).digest('base64url') !== signature) {
      throw new UnauthorizedError('Life2 token signature verification failed.');
    }

    return;
  }

  if (algorithm !== 'RS256') {
    throw new UnauthorizedError('Life2 token algorithm is not supported by the configured public key.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();

  if (!verifier.verify(createPublicKey(publicKey as string), decodeBase64UrlToBuffer(signature))) {
    throw new UnauthorizedError('Life2 token signature verification failed.');
  }
}

function decodeJwtSegment<T>(segment: string, label: string): T {
  try {
    return JSON.parse(decodeBase64Url(segment)) as T;
  } catch (error) {
    throw new UnauthorizedError(`Life2 token ${label} could not be parsed.`);
  }
}

function decodeBase64Url(value: string): string {
  return Buffer.from(normalizeBase64Url(value), 'base64').toString('utf8');
}

function decodeBase64UrlToBuffer(value: string): Buffer {
  return Buffer.from(normalizeBase64Url(value), 'base64');
}

function normalizeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;

  return padding ? normalized + '='.repeat(4 - padding) : normalized;
}

function firstNonEmptyClaim(values: unknown[]): string {
  const match = values.find(function findValue(value) {
    return (
      (typeof value === 'string' && value.trim()) ||
      (typeof value === 'number' && String(value).trim()) ||
      (typeof value === 'bigint' && String(value).trim())
    );
  });

  if (typeof match === 'string') {
    return match.trim();
  }

  if (typeof match === 'number' || typeof match === 'bigint') {
    return String(match).trim();
  }

  return '';
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha1').update(seed).digest();
  const bytes = Buffer.from(hash.slice(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    bytes.slice(0, 4).toString('hex'),
    bytes.slice(4, 6).toString('hex'),
    bytes.slice(6, 8).toString('hex'),
    bytes.slice(8, 10).toString('hex'),
    bytes.slice(10, 16).toString('hex')
  ].join('-');
}

function coalesceString(...values: unknown[]): string {
  const match = values.find(function findValue(value) {
    return typeof value === 'string' && value.trim();
  });

  return typeof match === 'string' ? match.trim() : '';
}

class UnauthorizedError extends Error {
  statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
