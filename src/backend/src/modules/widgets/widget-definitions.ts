export type WidgetDefinition = {
  type: string;
  name: string;
  title: string;
  description: string;
  defaultSize: {
    width: number;
    height: number;
  };
  minSize: {
    width: number;
    height: number;
  };
  refreshMode: 'SNAPSHOT' | 'LIVE' | 'HYBRID';
  createDefaultConfig(): Record<string, unknown>;
  createMockData(config: Record<string, unknown>): Record<string, unknown>;
};

const widgetDefinitions: WidgetDefinition[] = [
  {
    type: 'weather',
    name: 'Weather',
    title: 'Weather Outlook',
    description: 'Mocked daily forecast',
    defaultSize: { width: 320, height: 360 },
    minSize: { width: 320, height: 360 },
    refreshMode: 'SNAPSHOT',
    createDefaultConfig: function createDefaultConfig() {
      return {};
    },
    createMockData: function createMockData(config) {
      const location = getWeatherLocationLabel(config);

      return {
        location: location || 'Select a city',
        temperature: '18°',
        condition: 'Partly sunny',
        highLow: 'H: 20°  L: 11°',
        summary: location
          ? 'Mock data for the MVP. This widget will later hydrate from a briefing snapshot.'
          : 'Choose a city in edit mode to configure this widget.',
        details: location
          ? [
              { label: 'Feels like', value: '17°' },
              { label: 'Rain', value: '10%' },
              { label: 'UV', value: 'Moderate' }
            ]
          : []
      };
    }
  },
  {
    type: 'calendar',
    name: 'Calendar',
    title: 'Today on Calendar',
    description: 'Today\'s appointments',
    defaultSize: { width: 360, height: 360 },
    minSize: { width: 360, height: 260 },
    refreshMode: 'SNAPSHOT',
    createDefaultConfig: function createDefaultConfig() {
      return {};
    },
    createMockData: function createMockData(config) {
      const connectionLabel = getCalendarConnectionLabel(config);

      return {
        provider: 'google-calendar',
        connectionLabel: connectionLabel || 'Not connected',
        dateLabel: 'Today',
        emptyMessage: connectionLabel
          ? 'Live appointments will appear after you save the dashboard.'
          : 'Choose a Google Calendar connection in edit mode to configure this widget.',
        appointments: connectionLabel
          ? [
              { time: '09:00', title: 'Stand-up', location: 'Teams' },
              { time: '10:30', title: 'Deep work block', location: 'Home office' },
              { time: '13:00', title: 'Client review', location: 'WeWork Meeting Room' },
              { time: '19:00', title: 'Dinner reservation', location: 'Le Petit Marchand' }
            ]
          : []
      };
    }
  },
  {
    type: 'tasks',
    name: 'Task list',
    title: 'Task List',
    description: 'Today, tomorrow, and undated tasks',
    defaultSize: { width: 360, height: 360 },
    minSize: { width: 360, height: 260 },
    refreshMode: 'SNAPSHOT',
    createDefaultConfig: function createDefaultConfig() {
      return {};
    },
    createMockData: function createMockData(config) {
      const connectionLabel = getTaskConnectionLabel(config);

      return {
        provider: 'todoist',
        connectionLabel: connectionLabel || 'Not connected',
        emptyMessage: connectionLabel
          ? 'Live tasks will appear after you save the dashboard.'
          : 'Choose a Todoist connection in edit mode to configure this widget.',
        groups: connectionLabel
          ? [
              {
                label: 'Due Today',
                items: [
                  { title: 'Reply to insurance email' },
                  { title: 'Confirm dinner reservation' }
                ]
              },
              {
                label: 'Due Tomorrow',
                items: [
                  { title: 'Draft project update' },
                  { title: 'Buy birthday card' }
                ]
              },
              {
                label: 'No Due Date',
                items: [
                  { title: 'Declutter camera roll' },
                  { title: 'Research standing desk options' }
                ]
              }
            ]
          : []
      };
    }
  }
];

export function listWidgetDefinitions(): WidgetDefinition[] {
  return widgetDefinitions.slice();
}

export function getWidgetDefinition(type: string): WidgetDefinition | null {
  return widgetDefinitions.find(function (definition) {
    return definition.type === type;
  }) || null;
}

function getWeatherLocationLabel(config: Record<string, unknown>): string {
  if (typeof config.location === 'string' && config.location.trim()) {
    return config.location;
  }

  if (!config.location || typeof config.location !== 'object') {
    return '';
  }

  const location = config.location as {
    displayName?: unknown;
    name?: unknown;
    countryCode?: unknown;
  };

  if (typeof location.displayName === 'string' && location.displayName.trim()) {
    return location.displayName;
  }

  if (typeof location.name !== 'string' || !location.name.trim()) {
    return '';
  }

  if (typeof location.countryCode === 'string' && location.countryCode.trim()) {
    return location.name + ', ' + location.countryCode;
  }

  return location.name;
}

function getTaskConnectionLabel(config: Record<string, unknown>): string {
  if (typeof config.connectionName === 'string' && config.connectionName.trim()) {
    return config.connectionName;
  }

  return '';
}

function getCalendarConnectionLabel(config: Record<string, unknown>): string {
  if (typeof config.connectionName === 'string' && config.connectionName.trim()) {
    return config.connectionName;
  }

  return '';
}
