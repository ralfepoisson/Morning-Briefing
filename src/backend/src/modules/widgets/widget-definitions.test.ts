import test from 'node:test';
import assert from 'node:assert/strict';
import { getWidgetDefinition } from './widget-definitions.js';

test('weather widget defaults do not include mock forecast values', function () {
  const definition = getWidgetDefinition('weather');

  assert.ok(definition);
  assert.deepEqual(definition && definition.createMockData({
    location: {
      displayName: 'Mulhouse, FR'
    }
  }), {
    location: 'Mulhouse, FR',
    temperature: '',
    condition: '',
    highLow: '',
    summary: 'Weather data is still loading or unavailable. Refresh after the snapshot completes.',
    details: []
  });
});

test('task widget defaults do not include mock tasks when a connection is configured', function () {
  const definition = getWidgetDefinition('tasks');

  assert.ok(definition);
  assert.deepEqual(definition && definition.createMockData({
    connectionName: 'Todoist',
    showUndatedTasks: true
  }), {
    provider: 'todoist',
    connectionLabel: 'Todoist',
    emptyMessage: 'Tasks are still loading or unavailable. Refresh after the snapshot completes.',
    groups: []
  });
});

test('calendar widget defaults do not include mock appointments when a connection is configured', function () {
  const definition = getWidgetDefinition('calendar');

  assert.ok(definition);
  assert.deepEqual(definition && definition.createMockData({
    connectionName: 'Google Calendar'
  }), {
    provider: 'google-calendar',
    connectionLabel: 'Google Calendar',
    dateLabel: 'Today',
    emptyMessage: 'Calendar events are still loading or unavailable. Refresh after the snapshot completes.',
    appointments: []
  });
});

test('email widget defaults do not include mock messages when a connection is configured', function () {
  const definition = getWidgetDefinition('email');

  assert.ok(definition);
  assert.deepEqual(definition && definition.createMockData({
    connectionName: 'Gmail',
    filters: ['label:important']
  }), {
    provider: 'gmail',
    connectionLabel: 'Gmail',
    filters: ['label:important'],
    emptyMessage: 'Email messages are still loading or unavailable. Refresh after the snapshot completes.',
    messages: []
  });
});
