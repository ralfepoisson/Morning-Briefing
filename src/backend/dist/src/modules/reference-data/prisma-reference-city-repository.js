export class PrismaReferenceCityRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async search(query, limit) {
        const cities = await this.prisma.referenceCity.findMany({
            where: {
                isActive: true,
                OR: [
                    {
                        name: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        asciiName: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    }
                ]
            },
            orderBy: [
                {
                    population: 'desc'
                },
                {
                    name: 'asc'
                }
            ],
            take: limit
        });
        return cities.map(function mapCity(city) {
            return {
                id: city.id,
                geonameId: city.geonameId,
                name: city.name,
                asciiName: city.asciiName,
                countryCode: city.countryCode,
                adminName1: city.adminName1 || '',
                timezone: city.timezone || '',
                latitude: Number(city.latitude),
                longitude: Number(city.longitude)
            };
        });
    }
}
