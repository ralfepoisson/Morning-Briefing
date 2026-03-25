import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';
import { PrismaTenantAiConfigurationRepository } from '../tenant-ai-configuration/prisma-tenant-ai-configuration-repository.js';
import { TenantAiConfigurationService } from '../tenant-ai-configuration/tenant-ai-configuration-service.js';

export type AdminConfigurationRouteDependencies = {
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
  tenantAiConfigurationService: Pick<TenantAiConfigurationService, 'getConfiguration' | 'updateConfiguration'>;
};

export async function registerAdminConfigurationRoutes(
  app: FastifyInstance,
  dependencies: AdminConfigurationRouteDependencies = createAdminConfigurationRouteDependencies()
): Promise<void> {
  app.get('/api/v1/admin/configuration', async function handleGetConfiguration(request, reply) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);

    if (!user.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    return dependencies.tenantAiConfigurationService.getConfiguration(user.tenantId);
  });

  app.patch('/api/v1/admin/configuration', async function handleUpdateConfiguration(request, reply) {
    const user = await dependencies.defaultUserService.getDefaultUser(request);
    const body = request.body as {
      openAiApiKey?: string;
      openAiModel?: string;
    } | undefined;

    if (!user.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    return dependencies.tenantAiConfigurationService.updateConfiguration({
      tenantId: user.tenantId,
      openAiApiKey: body?.openAiApiKey,
      openAiModel: body?.openAiModel
    });
  });
}

function createAdminConfigurationRouteDependencies(): AdminConfigurationRouteDependencies {
  const prisma = getPrismaClient();

  return {
    defaultUserService: new DefaultUserService(prisma),
    tenantAiConfigurationService: new TenantAiConfigurationService(new PrismaTenantAiConfigurationRepository(prisma))
  };
}
