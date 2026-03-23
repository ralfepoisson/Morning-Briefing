import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';

type UserRouteDependencies = {
  prisma: Pick<PrismaClient, 'appUser'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

type AppUserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  timezone: string;
  locale: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function registerUserRoutes(
  app: FastifyInstance,
  dependencies: UserRouteDependencies = createUserRouteDependencies()
): Promise<void> {
  app.get('/api/v1/users/me', async function handleGetCurrentUser(request) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);

    return {
      user: {
        id: user.userId,
        tenantId: user.tenantId,
        displayName: user.displayName,
        email: user.email,
        timezone: user.timezone,
        locale: user.locale,
        isAdmin: user.isAdmin
      }
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
