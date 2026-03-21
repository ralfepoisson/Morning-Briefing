export class ReferenceCityService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async search(query) {
        var normalizedQuery = query.trim();
        if (!normalizedQuery) {
            return [];
        }
        const cities = await this.repository.search(normalizedQuery, 12);
        return cities.map(function toResponse(city) {
            return {
                id: city.id,
                geonameId: city.geonameId,
                name: city.name,
                countryCode: city.countryCode,
                adminName1: city.adminName1,
                timezone: city.timezone,
                latitude: city.latitude,
                longitude: city.longitude,
                displayName: [city.name, city.countryCode].filter(Boolean).join(', ')
            };
        });
    }
}
