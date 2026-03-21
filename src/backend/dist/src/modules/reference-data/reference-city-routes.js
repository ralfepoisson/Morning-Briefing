import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { PrismaReferenceCityRepository } from './prisma-reference-city-repository.js';
import { ReferenceCityService } from './reference-city-service.js';
export async function registerReferenceCityRoutes(app, dependencies = createReferenceCityRouteDependencies()) {
    const referenceCityService = dependencies.referenceCityService;
    app.get('/api/v1/reference/cities', async function handleSearchCities(request) {
        const query = request.query.q || '';
        const items = await referenceCityService.search(query);
        return {
            items: items
        };
    });
}
function createReferenceCityRouteDependencies() {
    const prisma = getPrismaClient();
    return {
        referenceCityService: new ReferenceCityService(new PrismaReferenceCityRepository(prisma))
    };
}
