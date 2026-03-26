import { createDashboardBriefingJobProcessor } from '../dashboard-briefings/dashboard-briefing-runtime.js';
import { getGoogleCalendarOAuthClientFromEnvironment } from '../connections/google-calendar-oauth-client.js';
import { PrismaRssFeedRepository } from '../rss-feeds/prisma-rss-feed-repository.js';
import { PrismaTenantAiConfigurationRepository } from '../tenant-ai-configuration/prisma-tenant-ai-configuration-repository.js';
import { TenantAiConfigurationService } from '../tenant-ai-configuration/tenant-ai-configuration-service.js';
import { GoogleCalendarClientImpl } from './google-calendar-client.js';
import { OpenAiNewsSummarizer } from './openai-news-summarizer.js';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { OpenMeteoWeatherClient } from './open-meteo-weather-client.js';
import { PrismaSnapshotRepository } from './prisma-snapshot-repository.js';
import { HttpRssFeedClient } from './rss-feed-client.js';
import { getSnapshotQueueConfig } from './snapshot-queue-config.js';
import { createSnapshotSqsClient } from './snapshot-sqs-client.js';
import { SnapshotJobProcessor } from './snapshot-job-processor.js';
import { QueueJobProcessor } from './queue-job-processor.js';
import type { SnapshotJobPublisher } from './snapshot-job-publisher.js';
import { SnapshotService } from './snapshot-service.js';
import { SqsSnapshotJobPublisher, NoopSnapshotJobPublisher } from './sqs-snapshot-job-publisher.js';
import { TodoistTaskClientImpl } from './todoist-task-client.js';
import { NightlyRefreshService } from './nightly-refresh-service.js';
import { XkcdClientImpl } from './xkcd-client.js';

export function createSnapshotService(): SnapshotService {
  const prisma = getPrismaClient();
  let googleCalendarOAuthClient;

  try {
    googleCalendarOAuthClient = getGoogleCalendarOAuthClientFromEnvironment();
  } catch {
    googleCalendarOAuthClient = {
      async refreshAccessToken() {
        throw new Error('Google OAuth is not configured.');
      }
    };
  }

  return new SnapshotService(
    new PrismaSnapshotRepository(prisma),
    new PrismaRssFeedRepository(prisma),
    new OpenMeteoWeatherClient(),
    new TodoistTaskClientImpl(),
    new GoogleCalendarClientImpl(),
    googleCalendarOAuthClient,
    new HttpRssFeedClient(),
    new OpenAiNewsSummarizer(),
    new XkcdClientImpl(),
    new TenantAiConfigurationService(new PrismaTenantAiConfigurationRepository(prisma))
  );
}

export function createSnapshotJobPublisherFromEnvironment(): SnapshotJobPublisher {
  const config = getSnapshotQueueConfig();

  if (!config.enabled || !config.queueUrl) {
    return new NoopSnapshotJobPublisher();
  }

  return new SqsSnapshotJobPublisher(createSnapshotSqsClient(), config.queueUrl);
}

export function createSnapshotJobProcessor(): SnapshotJobProcessor {
  const prisma = getPrismaClient();

  return new SnapshotJobProcessor(
    new PrismaSnapshotRepository(prisma),
    createSnapshotService()
  );
}

export function createQueueJobProcessor(): QueueJobProcessor {
  return new QueueJobProcessor(
    createSnapshotJobProcessor(),
    createDashboardBriefingJobProcessor()
  );
}

export function createNightlyRefreshService(): NightlyRefreshService {
  const prisma = getPrismaClient();

  return new NightlyRefreshService(
    new PrismaSnapshotRepository(prisma),
    createSnapshotJobPublisherFromEnvironment()
  );
}
