import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { logApplicationEvent, toLogErrorContext } from '../admin/application-logger.js';
export class DashboardBriefingTtsService {
    provider;
    storageDirectory;
    constructor(provider, storageDirectory) {
        this.provider = provider;
        this.storageDirectory = storageDirectory;
    }
    getProviderName() {
        return this.provider.providerName;
    }
    async generateAndStore(input) {
        logApplicationEvent({
            level: 'info',
            scope: 'dashboard-briefing',
            event: 'dashboard_briefing_tts_started',
            message: 'Starting dashboard briefing audio synthesis.',
            context: {
                briefingId: input.briefingId,
                provider: this.provider.providerName,
                voiceName: input.voiceName,
                targetDurationSeconds: input.targetDurationSeconds
            }
        });
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
        logApplicationEvent({
            level: 'info',
            scope: 'dashboard-briefing',
            event: 'dashboard_briefing_tts_completed',
            message: 'Dashboard briefing audio stored successfully.',
            context: {
                briefingId: input.briefingId,
                provider: this.provider.providerName,
                voiceName: input.voiceName,
                storageKey,
                mimeType: synthesized.mimeType,
                durationSeconds: synthesized.durationSeconds
            }
        });
        return {
            provider: this.provider.providerName,
            voiceName: input.voiceName,
            storageKey,
            mimeType: synthesized.mimeType,
            durationSeconds: synthesized.durationSeconds,
            generatedAt
        };
    }
    resolveStoragePath(storageKey) {
        return path.join(this.storageDirectory, storageKey);
    }
}
export class StubDashboardBriefingTtsProvider {
    providerName = 'stub-wave';
    async synthesize(input) {
        const durationSeconds = input.targetDurationSeconds || estimateDurationFromScript(input.script);
        return {
            audio: buildAudibleStubWav(Math.max(3, durationSeconds)),
            mimeType: 'audio/wav',
            durationSeconds: Math.max(3, durationSeconds)
        };
    }
}
export class AwsPollyDashboardBriefingTtsProvider {
    config;
    providerName = 'aws-polly';
    credentialsProvider;
    credentialSourceHint;
    constructor(config) {
        this.config = config;
        const credentialProfile = normalizeCredentialProfile(config.credentialProfile);
        this.credentialsProvider = credentialProfile
            ? defaultProvider({ profile: credentialProfile })
            : defaultProvider();
        this.credentialSourceHint = credentialProfile ? `shared-profile:${credentialProfile}` : 'default-provider-chain';
    }
    async synthesize(input) {
        const voiceId = normalizePollyVoiceId(input.voiceName, this.config.defaultVoiceId);
        try {
            const credentials = await this.credentialsProvider();
            logApplicationEvent({
                level: 'info',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_tts_credentials_resolved',
                message: 'Resolved AWS credentials for Polly synthesis.',
                context: {
                    provider: this.providerName,
                    region: this.config.region,
                    voiceId,
                    credentialSourceHint: this.credentialSourceHint,
                    accessKeyIdSuffix: maskAccessKeyId(credentials.accessKeyId),
                    sessionTokenPresent: !!credentials.sessionToken
                }
            });
            const client = new PollyClient({
                region: this.config.region,
                endpoint: this.config.endpoint,
                credentials
            });
            const response = await client.send(new SynthesizeSpeechCommand({
                Engine: 'neural',
                OutputFormat: 'mp3',
                Text: input.script,
                TextType: 'text',
                VoiceId: voiceId
            }));
            if (!response.AudioStream) {
                throw new Error('AWS Polly did not return audio content.');
            }
            const audio = Buffer.from(await response.AudioStream.transformToByteArray());
            return {
                audio,
                mimeType: 'audio/mpeg',
                durationSeconds: null
            };
        }
        catch (error) {
            logApplicationEvent({
                level: 'error',
                scope: 'dashboard-briefing',
                event: 'dashboard_briefing_tts_provider_failed',
                message: error instanceof Error ? error.message : 'AWS Polly synthesis failed.',
                context: {
                    provider: this.providerName,
                    region: this.config.region,
                    endpoint: this.config.endpoint || null,
                    voiceId,
                    ...toLogErrorContext(error)
                }
            });
            throw error;
        }
    }
}
function estimateDurationFromScript(script) {
    return Math.round(Math.max(30, script.split(/\s+/).filter(Boolean).length / 2.4));
}
function buildAudibleStubWav(durationSeconds) {
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
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const seconds = frameIndex / sampleRate;
        const gate = seconds % 1.5 < 0.28 ? 1 : 0;
        const baseSample = gate === 1
            ? (Math.sin(2 * Math.PI * 440 * seconds) * 0.35 +
                Math.sin(2 * Math.PI * 660 * seconds) * 0.2)
            : 0;
        const fadedSample = Math.max(-1, Math.min(1, baseSample));
        const sampleValue = Math.round(fadedSample * 32767);
        buffer.writeInt16LE(sampleValue, 44 + frameIndex * bytesPerSample);
    }
    return buffer;
}
function getExtensionForMimeType(mimeType) {
    if (mimeType === 'audio/mpeg') {
        return '.mp3';
    }
    if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
        return '.wav';
    }
    return '.bin';
}
function normalizePollyVoiceId(voiceName, fallbackVoiceId) {
    if (voiceName && voiceName !== 'default') {
        return voiceName;
    }
    if (fallbackVoiceId && fallbackVoiceId.trim()) {
        return fallbackVoiceId.trim();
    }
    return 'Joanna';
}
function normalizeCredentialProfile(profile) {
    if (profile && profile.trim()) {
        return profile.trim();
    }
    if (process.env.NODE_ENV !== 'production') {
        return 'default';
    }
    return null;
}
function maskAccessKeyId(accessKeyId) {
    if (!accessKeyId) {
        return 'unknown';
    }
    return accessKeyId.length <= 4 ? accessKeyId : accessKeyId.slice(-4);
}
