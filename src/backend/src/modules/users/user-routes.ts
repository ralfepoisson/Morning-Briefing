import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { isSupportedPreferredLanguage } from './user-language-options.js';

type UserRouteDependencies = {
  prisma: Pick<PrismaClient, 'appUser'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

type AppUserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  phoneticName: string | null;
  avatarDataUrl: string | null;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  preferredLanguage: string;
  isAdmin: boolean;
  isActive: boolean;
  telegramChatId: string | null;
  telegramDeliveryEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function registerUserRoutes(
  app: FastifyInstance,
  dependencies: UserRouteDependencies = createUserRouteDependencies()
): Promise<void> {
  app.get('/api/v1/users/me', async function handleGetCurrentUser(request) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);
    const persistedUser = await dependencies.prisma.appUser.findUnique({
      where: {
        id: user.userId
      }
    });

    return {
      user: serializeCurrentUser(persistedUser, user)
    };
  });

  app.patch('/api/v1/users/me', async function handleUpdateCurrentUser(request, reply) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);
    const body = request.body as {
      displayName?: unknown;
      phoneticName?: unknown;
      email?: unknown;
      avatarDataUrl?: unknown;
      timezone?: unknown;
      preferredLanguage?: unknown;
      briefingDelivery?: {
        telegram?: {
          enabled?: unknown;
          chatId?: unknown;
        };
      };
    } | undefined;

    if (!body || typeof body !== 'object') {
      reply.code(400);
      return {
        message: 'A profile payload is required.'
      };
    }

    if (typeof body.displayName !== 'undefined' && !isNonEmptyString(body.displayName)) {
      reply.code(400);
      return {
        message: 'displayName must be a non-empty string.'
      };
    }

    if (typeof body.phoneticName !== 'undefined' && body.phoneticName !== null && typeof body.phoneticName !== 'string') {
      reply.code(400);
      return {
        message: 'phoneticName must be a string when provided.'
      };
    }

    if (typeof body.email !== 'undefined' && !isValidEmail(body.email)) {
      reply.code(400);
      return {
        message: 'email must be a valid email address.'
      };
    }

    if (typeof body.avatarDataUrl !== 'undefined' && body.avatarDataUrl !== null && !isValidBase64ImageDataUrl(body.avatarDataUrl)) {
      reply.code(400);
      return {
        message: 'avatarDataUrl must be a valid base64 image data URL.'
      };
    }

    if (typeof body.avatarDataUrl === 'string' && body.avatarDataUrl.length > 5_000_000) {
      reply.code(400);
      return {
        message: 'avatarDataUrl must be smaller than 5 MB.'
      };
    }

    if (typeof body.timezone !== 'undefined' && !isValidTimezone(body.timezone)) {
      reply.code(400);
      return {
        message: 'timezone must be a valid IANA timezone.'
      };
    }

    if (typeof body.preferredLanguage !== 'undefined' && !isSupportedPreferredLanguage(body.preferredLanguage)) {
      reply.code(400);
      return {
        message: 'preferredLanguage must be one of the supported language codes.'
      };
    }

    if (
      body.briefingDelivery &&
      body.briefingDelivery.telegram &&
      typeof body.briefingDelivery.telegram.enabled !== 'undefined' &&
      typeof body.briefingDelivery.telegram.enabled !== 'boolean'
    ) {
      reply.code(400);
      return {
        message: 'briefingDelivery.telegram.enabled must be a boolean.'
      };
    }

    if (
      body.briefingDelivery &&
      body.briefingDelivery.telegram &&
      typeof body.briefingDelivery.telegram.chatId !== 'undefined' &&
      body.briefingDelivery.telegram.chatId !== null &&
      !isNonEmptyString(body.briefingDelivery.telegram.chatId)
    ) {
      reply.code(400);
      return {
        message: 'briefingDelivery.telegram.chatId must be a non-empty string when provided.'
      };
    }

    const updatedUser = await dependencies.prisma.appUser.update({
      where: {
        id: user.userId
      },
      data: {
        displayName: normalizeOptionalString(body.displayName, undefined),
        phoneticName: normalizeOptionalString(body.phoneticName, null),
        email: normalizeOptionalString(body.email, undefined),
        avatarDataUrl: normalizeOptionalString(body.avatarDataUrl, null),
        timezone: normalizeOptionalString(body.timezone, undefined),
        preferredLanguage: normalizeOptionalString(body.preferredLanguage, undefined),
        telegramChatId: normalizeTelegramChatId(body.briefingDelivery),
        telegramDeliveryEnabled: normalizeTelegramDeliveryEnabled(body.briefingDelivery)
      }
    });

    return {
      user: serializeCurrentUser(updatedUser, user)
    };
  });

  app.get('/api/v1/admin/users', async function handleListUsers(request, reply) {
    const currentUser = await dependencies.defaultUserService.getDefaultUser(request);

    if (!currentUser.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    const users = await dependencies.prisma.appUser.findMany({
      where: {
        tenantId: currentUser.tenantId
      },
      orderBy: [
        {
          displayName: 'asc'
        },
        {
          email: 'asc'
        }
      ]
    });

    return {
      items: users.map(function mapUser(user) {
        return serializeAdminUser(user, currentUser.userId);
      })
    };
  });

  app.patch('/api/v1/admin/users/:userId/access', async function handleUpdateUserAccess(request, reply) {
    const currentUser = await dependencies.defaultUserService.getDefaultUser(request);
    const params = request.params as { userId?: string };
    const body = request.body as { isAdmin?: unknown } | undefined;

    if (!currentUser.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    if (!params.userId) {
      reply.code(400);
      return {
        message: 'User id is required.'
      };
    }

    if (!body || typeof body.isAdmin !== 'boolean') {
      reply.code(400);
      return {
        message: 'isAdmin must be provided as a boolean.'
      };
    }

    const targetUser = await dependencies.prisma.appUser.findFirst({
      where: {
        id: params.userId,
        tenantId: currentUser.tenantId
      }
    });

    if (!targetUser) {
      reply.code(404);
      return {
        message: 'User not found.'
      };
    }

    if (targetUser.isAdmin && body.isAdmin === false) {
      const remainingAdminCount = await dependencies.prisma.appUser.count({
        where: {
          tenantId: currentUser.tenantId,
          isAdmin: true
        }
      });

      if (remainingAdminCount <= 1) {
        reply.code(409);
        return {
          message: 'At least one admin must remain for this account.'
        };
      }
    }

    const updatedUser = await dependencies.prisma.appUser.update({
      where: {
        id: targetUser.id
      },
      data: {
        isAdmin: body.isAdmin
      }
    });

    return {
      user: serializeAdminUser(updatedUser, currentUser.userId)
    };
  });
}

function createUserRouteDependencies(): UserRouteDependencies {
  const prisma = getPrismaClient();

  return {
    prisma,
    defaultUserService: new DefaultUserService(prisma)
  };
}

function serializeCurrentUser(user: Partial<AppUserRecord> | null | undefined, fallbackUser: {
  userId: string;
  tenantId: string;
  displayName: string;
  email: string;
  timezone: string;
  locale: string;
  preferredLanguage?: string | null;
  isAdmin: boolean;
}) {
  return {
    id: fallbackUser.userId,
    tenantId: fallbackUser.tenantId,
    displayName: user && typeof user.displayName === 'string' ? user.displayName : fallbackUser.displayName,
    phoneticName: user && typeof user.phoneticName === 'string' ? user.phoneticName : null,
    email: user && typeof user.email === 'string' ? user.email : fallbackUser.email,
    avatarDataUrl: user && typeof user.avatarDataUrl === 'string'
      ? user.avatarDataUrl
      : (user && typeof user.avatarUrl === 'string' ? user.avatarUrl : null),
    timezone: user && typeof user.timezone === 'string' ? user.timezone : fallbackUser.timezone,
    locale: user && typeof user.locale === 'string' ? user.locale : fallbackUser.locale,
    preferredLanguage: user && typeof user.preferredLanguage === 'string'
      ? user.preferredLanguage
      : (fallbackUser.preferredLanguage || fallbackUser.locale),
    isAdmin: user && typeof user.isAdmin === 'boolean' ? user.isAdmin : fallbackUser.isAdmin,
    briefingDelivery: {
      telegram: {
        enabled: !!(user && user.telegramDeliveryEnabled),
        chatId: user && typeof user.telegramChatId === 'string' ? user.telegramChatId : null
      }
    }
  };
}

function serializeAdminUser(user: AppUserRecord, currentUserId: string) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    timezone: user.timezone,
    locale: user.locale,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    isCurrentUser: user.id === currentUserId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value: unknown): value is string {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidTimezone(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, {
      timeZone: value.trim()
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeOptionalString(value: unknown, fallback: string | undefined | null): string | undefined | null {
  if (typeof value === 'undefined') {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value.trim() : fallback;
}

function isValidBase64ImageDataUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  return /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value.trim());
}

function normalizeTelegramChatId(briefingDelivery: {
  telegram?: {
    enabled?: unknown;
    chatId?: unknown;
  };
} | undefined): string | null | undefined {
  if (!briefingDelivery || !briefingDelivery.telegram || typeof briefingDelivery.telegram.chatId === 'undefined') {
    return undefined;
  }

  if (briefingDelivery.telegram.chatId === null) {
    return null;
  }

  return typeof briefingDelivery.telegram.chatId === 'string'
    ? briefingDelivery.telegram.chatId.trim()
    : undefined;
}

function normalizeTelegramDeliveryEnabled(briefingDelivery: {
  telegram?: {
    enabled?: unknown;
  };
} | undefined): boolean | undefined {
  if (!briefingDelivery || !briefingDelivery.telegram || typeof briefingDelivery.telegram.enabled === 'undefined') {
    return undefined;
  }

  return briefingDelivery.telegram.enabled === true;
}
