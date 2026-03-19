import type { ReferenceCityRepository } from './reference-city-repository.js';
import type { ReferenceCityResponse } from './reference-city-types.js';

export class ReferenceCityService {
  constructor(private readonly repository: ReferenceCityRepository) {}

  async search(query: string): Promise<ReferenceCityResponse[]> {
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
