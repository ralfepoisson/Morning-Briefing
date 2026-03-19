import type { ReferenceCityRecord } from './reference-city-types.js';

export interface ReferenceCityRepository {
  search(query: string, limit: number): Promise<ReferenceCityRecord[]>;
}
