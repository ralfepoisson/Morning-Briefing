import path from 'node:path';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { createSnapshotSqsClient } from '../snapshots/snapshot-sqs-client.js';
import { getSnapshotQueueConfig } from '../snapshots/snapshot-queue-config.js';
import { PrismaTenantAiConfigurationRepository } from '../tenant-ai-configuration/prisma-tenant-ai-configuration-repository.js';
import { TenantAiConfigurationService } from '../tenant-ai-configuration/tenant-ai-configuration-service.js';
import { DashboardBriefingAggregationService } from './dashboard-briefing-aggregation-service.js';
import { DashboardBriefingJobProcessor } from './dashboard-briefing-job-processor.js';
import type { DashboardBriefingJobPublisher } from './dashboard-briefing-job-publisher.js';
import { DashboardBriefingLlmService, StubDashboardBriefingLlmProvider, TenantConfiguredOpenAiDashboardBriefingLlmProvider } from './dashboard-briefing-llm-service.js';
import { DashboardBriefingPromptService } from './dashboard-briefing-prompt-service.js';
import { PrismaDashboardBriefingRepository } from './prisma-dashboard-briefing-repository.js';
import { DashboardBriefingService } from './dashboard-briefing-service.js';
import { SqsDashboardBriefingJobPublisher } from './sqs-dashboard-briefing-job-publisher.js';
import { AwsPollyDashboardBriefingTtsProvider, DashboardBriefingTtsService, StubDashboardBriefingTtsProvider } from './dashboard-briefing-tts-service.js';

export function createDashboardBriefingService(): DashboardBriefingService {
  const prisma = getPrismaClient();
  const repository = new PrismaDashboardBriefingRepository(prisma);
  const promptService = new DashboardBriefingPromptService();
  const tenantAiConfigurationService = new TenantAiConfigurationService(new PrismaTenantAiConfigurationRepository(prisma));

  return new DashboardBriefingService(
    repository,
    new DashboardBriefingAggregationService(repository),
    new DashboardBriefingLlmService(createLlmProvider(tenantAiConfigurationService), promptService),
    new DashboardBriefingTtsService(
      createTtsProvider(),
      getAudioStorageDirectory()
    )
  );
}

export function createDashboardBriefingJobPublisherFromEnvironment(): DashboardBriefingJobPublisher | null {
  const config = getSnapshotQueueConfig();

  if (!config.enabled || !config.queueUrl) {
    return null;
  }

  return new SqsDashboardBriefingJobPublisher(createSnapshotSqsClient(), config.queueUrl);
}

export function createDashboardBriefingJobProcessor(): DashboardBriefingJobProcessor {
  return new DashboardBriefingJobProcessor(createDashboardBriefingService());
}

function createLlmProvider(tenantAiConfigurationService: TenantAiConfigurationService) {
  if (process.env.NODE_ENV === 'test') {
    return new StubDashboardBriefingLlmProvider();
  }

  return new TenantConfiguredOpenAiDashboardBriefingLlmProvider(tenantAiConfigurationService);
}

function createTtsProvider() {
  if (process.env.NODE_ENV === 'test') {
    return new StubDashboardBriefingTtsProvider();
  }

  return new AwsPollyDashboardBriefingTtsProvider({
    region: process.env.AWS_REGION || 'eu-west-3',
    endpoint: process.env.AWS_ENDPOINT_URL_POLLY,
    defaultVoiceId: process.env.AUDIO_BRIEFING_TTS_POLLY_VOICE || 'Joanna',
    credentialProfile: process.env.AWS_PROFILE
  });
}

function getAudioStorageDirectory(): string {
  if (process.env.AUDIO_BRIEFING_STORAGE_DIR && process.env.AUDIO_BRIEFING_STORAGE_DIR.trim()) {
    return process.env.AUDIO_BRIEFING_STORAGE_DIR.trim();
  }

  return path.resolve(process.cwd(), 'data');
}
