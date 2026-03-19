import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { PrismaReferenceCityRepository } from './prisma-reference-city-repository.js';
import { ReferenceCityService } from './reference-city-service.js';

export type ReferenceCityRouteDependencies = {
  referenceCityService: Pick<ReferenceCityService, 'search'>;
};

export async function registerReferenceCityRoutes(
  app: FastifyInstance,
  dependencies: ReferenceCityRouteDependencies = createReferenceCityRouteDependencies()
): Promise<void> {
  const referenceCityService = dependencies.referenceCityService;

  app.get('/api/v1/reference/cities', async function handleSearchCities(request) {
    const query = (request.query as { q?: string }).q || '';
    const items = await referenceCityService.search(query);

    return {
      items: items
    };
  });
}

function createReferenceCityRouteDependencies(): ReferenceCityRouteDependencies {
  const prisma = getPrismaClient();

  return {
    referenceCityService: new ReferenceCityService(new PrismaReferenceCityRepository(prisma))
  };
}
