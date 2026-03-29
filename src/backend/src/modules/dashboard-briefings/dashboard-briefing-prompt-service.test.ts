import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardBriefingPromptService } from './dashboard-briefing-prompt-service.js';
import type { DashboardBriefingInput } from './dashboard-briefing-types.js';

test('DashboardBriefingPromptService fallback script prefers listener phonetic name in greeting', function () {
  const service = new DashboardBriefingPromptService();

  const result = service.buildFallbackScript(createInput({
    greetingName: 'Ralf'
  }));

  assert.match(result.fullScript, /^Hi there Ralf\./);
});

test('DashboardBriefingPromptService fallback script falls back to first name when phonetic name is missing', function () {
  const service = new DashboardBriefingPromptService();

  const result = service.buildFallbackScript(createInput({
    greetingName: 'Ralfe'
  }));

  assert.match(result.fullScript, /^Hi there Ralfe\./);
});

test('DashboardBriefingPromptService fallback script uses a generic greeting when no name is available', function () {
  const service = new DashboardBriefingPromptService();

  const result = service.buildFallbackScript(createInput({
    greetingName: null
  }));

  assert.match(result.fullScript, /^Hi there\./);
});

test('DashboardBriefingPromptService buildPrompt instructs the model to answer in the preferred language', function () {
  const service = new DashboardBriefingPromptService();

  const prompt = service.buildPrompt(createInput({
    greetingName: 'Ralfe'
  }));

  assert.match(prompt.developer, /Ensure the final output is in fr-FR\./);
});

function createInput(listener: DashboardBriefingInput['listener']): DashboardBriefingInput {
  return {
    tenantId: 'tenant-1',
    dashboardId: 'dash-1',
    dashboardName: 'Morning Briefing',
    generatedAt: '2026-03-27T06:00:00.000Z',
    language: 'en-GB',
    preferredLanguage: 'fr-FR',
    tone: 'calm, concise, professional',
    targetDurationSeconds: 75,
    listener,
    sections: [
      {
        widgetId: 'weather-1',
        widgetType: 'weather',
        title: 'Weather Outlook',
        importance: 'high',
        content: {
          location: 'Mulhouse, FR',
          summary: 'A dry and bright start with a mild afternoon.'
        }
      }
    ]
  };
}
