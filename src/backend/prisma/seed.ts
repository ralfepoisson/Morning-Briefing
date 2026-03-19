import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const snapshotDate = new Date('2026-03-19');

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-tenant' },
    update: {},
    create: {
      name: 'Demo Tenant',
      slug: 'demo-tenant'
    }
  });

  const user = await prisma.appUser.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'demo.user@example.com'
      }
    },
    update: {
      displayName: 'Demo User',
      timezone: 'Europe/Paris',
      locale: 'en-GB',
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: 'demo.user@example.com',
      displayName: 'Demo User',
      timezone: 'Europe/Paris',
      locale: 'en-GB'
    }
  });

  const existingDashboard = await prisma.dashboard.findFirst({
    where: {
      tenantId: tenant.id,
      ownerUserId: user.id,
      name: 'Morning Focus'
    }
  });

  const dashboard = existingDashboard
    ? await prisma.dashboard.update({
        where: { id: existingDashboard.id },
        data: {
          description: 'Seed dashboard for local backend development.',
          dashboardType: 'PERSONAL',
          isDefault: true,
          isActive: true,
          themeJson: {
            key: 'aurora'
          }
        }
      })
    : await prisma.dashboard.create({
        data: {
          tenantId: tenant.id,
          ownerUserId: user.id,
          name: 'Morning Focus',
          description: 'Seed dashboard for local backend development.',
          dashboardType: 'PERSONAL',
          isDefault: true,
          isActive: true,
          themeJson: {
            key: 'aurora'
          }
        }
      });

  const existingWeatherWidget = await prisma.dashboardWidget.findFirst({
    where: {
      dashboardId: dashboard.id,
      widgetType: 'weather',
      title: 'Paris Weather'
    }
  });

  const weatherWidget = existingWeatherWidget
    ? await prisma.dashboardWidget.update({
        where: { id: existingWeatherWidget.id },
        data: {
          positionX: 24,
          positionY: 24,
          width: 320,
          height: 360,
          minWidth: 320,
          minHeight: 360,
          isVisible: true,
          refreshMode: 'SNAPSHOT',
          sortOrder: 1,
          configJson: {
            location: 'Paris, France',
            units: 'metric'
          }
        }
      })
    : await prisma.dashboardWidget.create({
        data: {
          tenantId: tenant.id,
          dashboardId: dashboard.id,
          widgetType: 'weather',
          title: 'Paris Weather',
          positionX: 24,
          positionY: 24,
          width: 320,
          height: 360,
          minWidth: 320,
          minHeight: 360,
          refreshMode: 'SNAPSHOT',
          sortOrder: 1,
          configJson: {
            location: 'Paris, France',
            units: 'metric'
          }
        }
      });

  const snapshot = await prisma.briefingSnapshot.upsert({
    where: {
      userId_dashboardId_snapshotDate: {
        userId: user.id,
        dashboardId: dashboard.id,
        snapshotDate
      }
    },
    update: {
      generationStatus: 'READY',
      summaryJson: {
        headline: 'A clear and calm start to the day.'
      }
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      dashboardId: dashboard.id,
      snapshotDate,
      generationStatus: 'READY',
      summaryJson: {
        headline: 'A clear and calm start to the day.'
      }
    }
  });

  const existingWidgetSnapshot = await prisma.widgetSnapshot.findFirst({
    where: {
      snapshotId: snapshot.id,
      dashboardWidgetId: weatherWidget.id
    }
  });

  if (existingWidgetSnapshot) {
    await prisma.widgetSnapshot.update({
      where: { id: existingWidgetSnapshot.id },
      data: {
        widgetType: 'weather',
        title: 'Paris Weather',
        status: 'READY',
        contentJson: {
          location: 'Paris, France',
          temperature: '14°',
          condition: 'Clear and bright',
          highLow: 'H: 17°  L: 9°'
        }
      }
    });
  } else {
    await prisma.widgetSnapshot.create({
      data: {
        snapshotId: snapshot.id,
        dashboardWidgetId: weatherWidget.id,
        widgetType: 'weather',
        title: 'Paris Weather',
        status: 'READY',
        contentJson: {
          location: 'Paris, France',
          temperature: '14°',
          condition: 'Clear and bright',
          highLow: 'H: 17°  L: 9°'
        }
      }
    });
  }

  console.log('Seed data created.');
}

main()
  .catch(async function handleError(error) {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async function disconnect() {
    await prisma.$disconnect();
  });
