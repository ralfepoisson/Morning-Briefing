import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DefaultUserService } from '../default-user/default-user-service.js';

type AdminConnectorRouteDependencies = {
  prisma: Pick<PrismaClient, 'connector'>;
  defaultUserService: Pick<DefaultUserService, 'getDefaultUser'>;
};

export async function registerAdminConnectorRoutes(
  app: FastifyInstance,
  dependencies: AdminConnectorRouteDependencies = createAdminConnectorRouteDependencies()
): Promise<void> {
  app.get('/api/v1/admin/connectors', async function handleListConnectors(request, reply) {
    const currentUser = await dependencies.defaultUserService.getDefaultUser(request);

    if (!currentUser.isAdmin) {
      reply.code(403);
      return {
        message: 'Admin access is required.'
      };
    }

    const connectors = await dependencies.prisma.connector.findMany({
      where: {
        tenantId: currentUser.tenantId
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        widgets: {
          where: {
            dashboardWidget: {
              archivedAt: null,
              dashboard: {
                archivedAt: null
              }
            }
          },
          select: {
            usageRole: true,
            dashboardWidget: {
              select: {
                id: true,
                widgetType: true,
                title: true,
                isVisible: true,
                dashboard: {
                  select: {
                    id: true,
                    name: true,
                    owner: {
                      select: {
                        id: true,
                        displayName: true,
                        email: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        {
          updatedAt: 'desc'
        },
        {
          createdAt: 'desc'
        }
      ]
    });

    return {
      items: connectors.map(serializeAdminConnector)
    };
  });
}

function createAdminConnectorRouteDependencies(): AdminConnectorRouteDependencies {
  const prisma = getPrismaClient();

  return {
    prisma,
    defaultUserService: new DefaultUserService(prisma)
  };
}

function serializeAdminConnector(connector: {
  id: string;
  connectorType: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  authType: 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC';
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  widgets: Array<{
    usageRole: string;
    dashboardWidget: {
      id: string;
      widgetType: string;
      title: string;
      isVisible: boolean;
      dashboard: {
        id: string;
        name: string;
        owner: {
          id: string;
          displayName: string;
          email: string;
        };
      };
    };
  }>;
}) {
  return {
    id: connector.id,
    type: connector.connectorType,
    name: connector.name,
    status: connector.status,
    authType: connector.authType,
    config: sanitizeConnectionConfig(connector.connectorType, asObject(connector.configJson)),
    owner: connector.owner ? {
      id: connector.owner.id,
      displayName: connector.owner.displayName,
      email: connector.owner.email
    } : null,
    widgets: connector.widgets.map(function mapUsage(usage) {
      return {
        usageRole: usage.usageRole,
        widgetId: usage.dashboardWidget.id,
        widgetType: usage.dashboardWidget.widgetType,
        widgetTitle: usage.dashboardWidget.title,
        isVisible: usage.dashboardWidget.isVisible,
        dashboardId: usage.dashboardWidget.dashboard.id,
        dashboardName: usage.dashboardWidget.dashboard.name,
        dashboardOwner: {
          id: usage.dashboardWidget.dashboard.owner.id,
          displayName: usage.dashboardWidget.dashboard.owner.displayName,
          email: usage.dashboardWidget.dashboard.owner.email
        }
      };
    }),
    createdAt: connector.createdAt.toISOString(),
    updatedAt: connector.updatedAt.toISOString()
  };
}

function sanitizeConnectionConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
  if (type === 'google-calendar') {
    return {
      calendarId: typeof config.calendarId === 'string' ? config.calendarId : '',
      accountEmail: typeof config.accountEmail === 'string' ? config.accountEmail : '',
      accountLabel: typeof config.accountLabel === 'string' ? config.accountLabel : '',
      timezone: typeof config.timezone === 'string' ? config.timezone : ''
    };
  }

  if (type === 'openai') {
    return {
      model: typeof config.model === 'string' ? config.model : 'gpt-5-mini',
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : 'https://api.openai.com'
    };
  }

  return {};
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
