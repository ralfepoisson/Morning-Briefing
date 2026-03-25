import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { describeFetchFailure } from '../../shared/fetch-error.js';

export interface DashboardBriefingTtsProvider {
  readonly providerName: string;
  synthesize(input: {
    script: string;
    voiceName: string;
    targetDurationSeconds: number | null;
  }): Promise<{
    audio: Buffer;
    mimeType: string;
    durationSeconds: number | null;
  }>;
}

export class DashboardBriefingTtsService {
  constructor(
    private readonly provider: DashboardBriefingTtsProvider,
    private readonly storageDirectory: string
  ) {}

  getProviderName(): string {
    return this.provider.providerName;
  }

  async generateAndStore(input: {
    briefingId: string;
    script: string;
    voiceName: string;
    targetDurationSeconds: number | null;
  }): Promise<{
    provider: string;
    voiceName: string;
    storageKey: string;
    mimeType: string;
    durationSeconds: number | null;
    generatedAt: Date;
  }> {
    const synthesized = await this.provider.synthesize({
      script: input.script,
      voiceName: input.voiceName,
      targetDurationSeconds: input.targetDurationSeconds
    });
    const generatedAt = new Date();
    const extension = getExtensionForMimeType(synthesized.mimeType);
    const fileName = randomUUID() + extension;
    const relativeDir = path.join('audio-briefings', input.briefingId);
    const absoluteDir = path.join(this.storageDirectory, relativeDir);
    const storageKey = path.join(relativeDir, fileName);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(this.storageDirectory, storageKey), synthesized.audio);

    return {
      provider: this.provider.providerName,
      voiceName: input.voiceName,
      storageKey,
      mimeType: synthesized.mimeType,
      durationSeconds: synthesized.durationSeconds,
      generatedAt
    };
  }

  resolveStoragePath(storageKey: string): string {
    return path.join(this.storageDirectory, storageKey);
  }
}

export class StubDashboardBriefingTtsProvider implements DashboardBriefingTtsProvider {
  readonly providerName = 'stub-wave';

  async synthesize(input: {
    script: string;
    targetDurationSeconds: number | null;
  }): Promise<{
    audio: Buffer;
    mimeType: string;
    durationSeconds: number;
  }> {
    const durationSeconds = input.targetDurationSeconds || estimateDurationFromScript(input.script);

    return {
      audio: buildSilentWav(Math.max(3, durationSeconds)),
      mimeType: 'audio/wav',
      durationSeconds: Math.max(3, durationSeconds)
    };
  }
}

export class OpenAiDashboardBriefingTtsProvider implements DashboardBriefingTtsProvider {
  readonly providerName = 'openai';

  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    }
  ) {}

  async synthesize(input: {
    script: string;
    voiceName: string;
  }): Promise<{
    audio: Buffer;
    mimeType: string;
    durationSeconds: number | null;
  }> {
    const baseUrl = (this.config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const url = baseUrl + '/v1/audio/speech';
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + this.config.apiKey
        },
        body: JSON.stringify({
          model: this.config.model,
          voice: input.voiceName,
          input: input.script,
          format: 'wav'
        })
      });
    } catch (error) {
      throw new Error(describeFetchFailure('OpenAI TTS request', url, error));
    }

    if (!response.ok) {
      throw new Error(`OpenAI TTS request failed with status ${response.status}.`);
    }

    const audio = Buffer.from(await response.arrayBuffer());

    return {
      audio,
      mimeType: 'audio/wav',
      durationSeconds: null
    };
  }
}

function estimateDurationFromScript(script: string): number {
  return Math.round(Math.max(30, script.split(/\s+/).filter(Boolean).length / 2.4));
}

function buildSilentWav(durationSeconds: number): Buffer {
  const sampleRate = 16000;
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = durationSeconds * sampleRate;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function getExtensionForMimeType(mimeType: string): string {
  if (mimeType === 'audio/mpeg') {
    return '.mp3';
  }

  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
    return '.wav';
  }

  return '.bin';
}
