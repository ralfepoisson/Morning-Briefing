import path from 'node:path';
import { getPrismaClient } from '../../infrastructure/prisma/prisma-client.js';
import { DashboardBriefingAggregationService } from './dashboard-briefing-aggregation-service.js';
import { DashboardBriefingLlmService, OpenAiDashboardBriefingLlmProvider, StubDashboardBriefingLlmProvider } from './dashboard-briefing-llm-service.js';
import { DashboardBriefingPromptService } from './dashboard-briefing-prompt-service.js';
import { PrismaDashboardBriefingRepository } from './prisma-dashboard-briefing-repository.js';
import { DashboardBriefingService } from './dashboard-briefing-service.js';
import { DashboardBriefingTtsService, OpenAiDashboardBriefingTtsProvider, StubDashboardBriefingTtsProvider } from './dashboard-briefing-tts-service.js';

export function createDashboardBriefingService(): DashboardBriefingService {
  const prisma = getPrismaClient();
  const repository = new PrismaDashboardBriefingRepository(prisma);
  const promptService = new DashboardBriefingPromptService();

  return new DashboardBriefingService(
    repository,
    new DashboardBriefingAggregationService(repository),
    new DashboardBriefingLlmService(createLlmProviderFromEnvironment(), promptService),
    new DashboardBriefingTtsService(
      createTtsProviderFromEnvironment(),
      getAudioStorageDirectory()
    )
  );
}

function createLlmProviderFromEnvironment() {
  if (
    process.env.AUDIO_BRIEFING_LLM_PROVIDER === 'openai' &&
    process.env.AUDIO_BRIEFING_LLM_API_KEY &&
    process.env.AUDIO_BRIEFING_LLM_MODEL
  ) {
    return new OpenAiDashboardBriefingLlmProvider({
      apiKey: process.env.AUDIO_BRIEFING_LLM_API_KEY,
      model: process.env.AUDIO_BRIEFING_LLM_MODEL,
      baseUrl: process.env.AUDIO_BRIEFING_LLM_BASE_URL
    });
  }

  return new StubDashboardBriefingLlmProvider();
}

function createTtsProviderFromEnvironment() {
  if (
    process.env.AUDIO_BRIEFING_TTS_PROVIDER === 'openai' &&
    process.env.AUDIO_BRIEFING_TTS_API_KEY &&
    process.env.AUDIO_BRIEFING_TTS_MODEL
  ) {
    return new OpenAiDashboardBriefingTtsProvider({
      apiKey: process.env.AUDIO_BRIEFING_TTS_API_KEY,
      model: process.env.AUDIO_BRIEFING_TTS_MODEL,
      baseUrl: process.env.AUDIO_BRIEFING_TTS_BASE_URL
    });
  }

  return new StubDashboardBriefingTtsProvider();
}

function getAudioStorageDirectory(): string {
  if (process.env.AUDIO_BRIEFING_STORAGE_DIR && process.env.AUDIO_BRIEFING_STORAGE_DIR.trim()) {
    return process.env.AUDIO_BRIEFING_STORAGE_DIR.trim();
  }

  return path.resolve(process.cwd(), 'data');
}
