import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listApplicationLogs, resetApplicationLogs } from '../admin/application-log-store.js';
import { TelegramDashboardBriefingDeliveryChannel } from './dashboard-briefing-delivery-service.js';
import type { DashboardBriefingResponse } from './dashboard-briefing-types.js';
import type { DefaultUserContext } from '../default-user/default-user-service.js';

test.afterEach(function () {
  resetApplicationLogs();
});

test('Telegram delivery logs a specific skip reason when audio is missing', async function () {
  const channel = new TelegramDashboardBriefingDeliveryChannel({
    appUser: {
      async findUnique() {
        return {
          displayName: 'Ralfe',
          telegramChatId: '123456789',
          telegramDeliveryEnabled: true
        };
      }
    }
  } as never, {
    botToken: 'token'
  });

  const delivered = await channel.deliverGeneratedAudio(createInput({
    audio: null
  }));

  assert.equal(delivered, false);
  assertLog('dashboard_briefing_delivery_skipped', {
    reason: 'audio_missing',
    channel: 'telegram',
    jobId: 'job-1'
  });
});

test('Telegram delivery logs a specific skip reason when no bot token is configured', async function () {
  const channel = new TelegramDashboardBriefingDeliveryChannel({
    appUser: {
      async findUnique() {
        return {
          displayName: 'Ralfe',
          telegramChatId: '123456789',
          telegramDeliveryEnabled: true
        };
      }
    }
  } as never);

  const delivered = await channel.deliverGeneratedAudio(createInput());

  assert.equal(delivered, false);
  assertLog('dashboard_briefing_delivery_skipped', {
    reason: 'bot_token_missing',
    channel: 'telegram',
    jobId: 'job-1'
  });
});

test('Telegram delivery logs attempt start and success context', async function () {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'telegram-delivery-test-'));
  const audioPath = path.join(tempDir, 'briefing.mp3');
  await writeFile(audioPath, Buffer.from('audio-bytes'));

  const channel = new TelegramDashboardBriefingDeliveryChannel({
    appUser: {
      async findUnique() {
        return {
          displayName: 'Ralfe',
          telegramChatId: '123456789',
          telegramDeliveryEnabled: true
        };
      }
    }
  } as never, {
    botToken: 'token'
  }, async function fetchImpl() {
    return new Response('', {
      status: 200
    });
  });

  const delivered = await channel.deliverGeneratedAudio(createInput({
    storagePath: audioPath
  }));

  assert.equal(delivered, true);
  assertLog('dashboard_briefing_delivery_attempt_started', {
    channel: 'telegram',
    jobId: 'job-1',
    chatIdSuffix: '6789',
    mimeType: 'audio/mpeg'
  });
  assertLog('dashboard_briefing_delivery_sent', {
    channel: 'telegram',
    jobId: 'job-1',
    chatIdSuffix: '6789'
  });
});

test('Telegram delivery logs Telegram response details on failure', async function () {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'telegram-delivery-test-fail-'));
  const audioPath = path.join(tempDir, 'briefing.mp3');
  await writeFile(audioPath, Buffer.from('audio-bytes'));

  const channel = new TelegramDashboardBriefingDeliveryChannel({
    appUser: {
      async findUnique() {
        return {
          displayName: 'Ralfe',
          telegramChatId: '123456789',
          telegramDeliveryEnabled: true
        };
      }
    }
  } as never, {
    botToken: 'token'
  }, async function fetchImpl() {
    return new Response(JSON.stringify({
      ok: false,
      description: 'Bad Request: chat not found'
    }), {
      status: 400,
      headers: {
        'content-type': 'application/json'
      }
    });
  });

  await assert.rejects(function () {
    return channel.deliverGeneratedAudio(createInput({
      storagePath: audioPath
    }));
  }, /Telegram delivery failed with status 400/);

  assertLog('dashboard_briefing_delivery_channel_failed', {
    channel: 'telegram',
    jobId: 'job-1',
    chatIdSuffix: '6789'
  });
  const failure = findLog('dashboard_briefing_delivery_channel_failed');
  assert.match(String(failure.message), /chat not found/);
});

function createInput(overrides: Partial<{
  audio: ReturnType<typeof createAudio>;
  storagePath: string;
}> = {}) {
  return {
    user: createUser(),
    briefing: createBriefing(),
    audio: overrides.audio === undefined ? createAudio() : overrides.audio,
    storagePath: overrides.storagePath || path.join(os.tmpdir(), 'missing-audio.mp3'),
    deliveryContext: {
      jobId: 'job-1'
    }
  };
}

function createUser(): DefaultUserContext {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Ralfe',
    phoneticName: 'Ralf',
    timezone: 'Europe/Paris',
    locale: 'en-GB',
    email: 'ralfe@example.com',
    isAdmin: true
  };
}

function createBriefing(): DashboardBriefingResponse {
  return {
    id: 'briefing-1',
    dashboardId: 'dash-1',
    status: 'READY',
    sourceSnapshotHash: 'hash-1',
    generatedAt: '2026-03-27T18:00:00.000Z',
    modelName: 'stub',
    promptVersion: 'v1',
    scriptText: 'Hello',
    scriptJson: {
      title: 'Morning Briefing'
    },
    estimatedDurationSeconds: 60,
    errorMessage: null,
    sourceWidgetTypes: ['weather'],
    createdAt: '2026-03-27T17:59:00.000Z',
    updatedAt: '2026-03-27T18:00:00.000Z',
    audio: createAudio()
  };
}

function createAudio() {
  return {
    id: 'audio-1',
    provider: 'stub',
    voiceName: 'default',
    mimeType: 'audio/mpeg',
    durationSeconds: 60,
    generatedAt: '2026-03-27T18:00:00.000Z',
    createdAt: '2026-03-27T18:00:00.000Z',
    updatedAt: '2026-03-27T18:00:00.000Z',
    playbackUrl: '/api/v1/dashboard-briefing-audio/audio-1/content'
  };
}

function findLog(event: string) {
  const entry = listApplicationLogs().find(function (candidate) {
    return candidate.event === event;
  });

  assert.ok(entry, `Expected log event ${event} to exist.`);
  return entry;
}

function assertLog(event: string, expectedContext: Record<string, unknown>) {
  const entry = findLog(event);

  for (const [key, value] of Object.entries(expectedContext)) {
    assert.deepEqual(entry.context[key], value);
  }
}
