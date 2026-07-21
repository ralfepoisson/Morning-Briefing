import test from 'node:test';
import assert from 'node:assert/strict';
import { TenantAiConfigurationService } from './tenant-ai-configuration-service.js';
import type { TenantAiConfigurationRepository } from './tenant-ai-configuration-repository.js';

function repositoryFixture(): TenantAiConfigurationRepository {
  return {
    async findByTenantId(tenantId) {
      return {
        id: 'config-1',
        tenantId,
        openAiModel: 'gpt-5-mini',
        createdAt: new Date('2026-03-25T20:00:00.000Z'),
        updatedAt: new Date('2026-03-25T20:10:00.000Z')
      };
    },
    async upsertByTenantId(input) {
      assert.deepEqual(input, {
        tenantId: 'tenant-1',
        openAiModel: 'gpt-5'
      });
      return {
        id: 'config-1',
        tenantId: input.tenantId,
        openAiModel: input.openAiModel,
        createdAt: new Date('2026-03-25T20:00:00.000Z'),
        updatedAt: new Date('2026-03-25T20:20:00.000Z')
      };
    }
  };
}

test('tenant AI configuration reads the OpenAI key only from the process environment', async function () {
  const service = new TenantAiConfigurationService(repositoryFixture(), {
    OPENAI_API_KEY: 'environment-only-key'
  });

  const overview = await service.getConfiguration('tenant-1');
  const required = await service.getRequiredOpenAiConfiguration('tenant-1');

  assert.equal(overview.hasOpenAiApiKey, true);
  assert.deepEqual(required, {
    apiKey: 'environment-only-key',
    model: 'gpt-5-mini'
  });
});

test('tenant AI configuration rejects a missing environment key', async function () {
  const service = new TenantAiConfigurationService(repositoryFixture(), {});

  await assert.rejects(
    service.getRequiredOpenAiConfiguration('tenant-1'),
    /OPENAI_API_KEY is not configured/
  );
});

test('tenant AI configuration persists only the non-secret model selection', async function () {
  const service = new TenantAiConfigurationService(repositoryFixture(), {
    OPENAI_API_KEY: 'environment-only-key'
  });

  const saved = await service.updateConfiguration({
    tenantId: 'tenant-1',
    openAiModel: 'gpt-5'
  });

  assert.equal(saved.openAiModel, 'gpt-5');
  assert.equal(saved.hasOpenAiApiKey, true);
});
