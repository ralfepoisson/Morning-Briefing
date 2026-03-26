import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWavFromPcm16Mono,
  calculatePcmDurationSeconds,
  StubDashboardBriefingTtsProvider
} from './dashboard-briefing-tts-service.js';

test('StubDashboardBriefingTtsProvider produces audible non-silent wav content', async function () {
  const provider = new StubDashboardBriefingTtsProvider();
  const result = await provider.synthesize({
    script: 'Good morning. Here is your audio briefing.',
    voiceName: 'default',
    targetDurationSeconds: 3
  });

  assert.equal(result.mimeType, 'audio/wav');
  assert.equal(result.durationSeconds, 3);
  assert.equal(result.audio.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(result.audio.subarray(8, 12).toString('ascii'), 'WAVE');

  const pcmSamples = new Int16Array(
    result.audio.buffer,
    result.audio.byteOffset + 44,
    Math.floor((result.audio.byteLength - 44) / 2)
  );
  const hasAudibleSample = pcmSamples.some(function hasAudibleSample(sample) {
    return sample !== 0;
  });

  assert.equal(hasAudibleSample, true);
});

test('buildWavFromPcm16Mono wraps PCM audio and reports exact duration', function () {
  const sampleRate = 16000;
  const durationSeconds = 2;
  const pcmAudio = Buffer.alloc(sampleRate * durationSeconds * 2);
  const wavAudio = buildWavFromPcm16Mono(pcmAudio, sampleRate);

  assert.equal(wavAudio.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(wavAudio.subarray(8, 12).toString('ascii'), 'WAVE');
  assert.equal(calculatePcmDurationSeconds(pcmAudio, sampleRate, 16, 1), durationSeconds);
  assert.equal(wavAudio.byteLength, pcmAudio.byteLength + 44);
});
