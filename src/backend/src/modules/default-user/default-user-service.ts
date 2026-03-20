import type { PrismaClient } from '@prisma/client';

const DEFAULT_TENANT_SLUG = 'ralfe-local';
const DEFAULT_USER_EMAIL = 'ralfe@example.com';

export type DefaultUserContext = {
  tenantId: string;
  userId: string;
  displayName: string;
  timezone: string;
};

export class DefaultUserService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDefaultUser(): Promise<DefaultUserContext> {
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

    const user = await this.prisma.appUser.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: DEFAULT_USER_EMAIL
        }
      },
      update: {
        displayName: 'Ralfe',
        timezone: 'Europe/Paris',
        locale: 'en-GB',
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        email: DEFAULT_USER_EMAIL,
        displayName: 'Ralfe',
        timezone: 'Europe/Paris',
        locale: 'en-GB'
      }
    });

    return {
      tenantId: tenant.id,
      userId: user.id,
      displayName: user.displayName,
      timezone: user.timezone
    };
  }
}
