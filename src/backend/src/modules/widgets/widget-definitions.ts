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
  createMockData(): Record<string, unknown>;
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
      return {
        location: 'Paris, France',
        units: 'metric'
      };
    },
    createMockData: function createMockData() {
      return {
        location: 'Paris, France',
        temperature: '18°',
        condition: 'Partly sunny',
        highLow: 'H: 20°  L: 11°',
        summary: 'Mock data for the MVP. This widget will later hydrate from a briefing snapshot.',
        details: [
          { label: 'Feels like', value: '17°' },
          { label: 'Rain', value: '10%' },
          { label: 'UV', value: 'Moderate' }
        ]
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
      return {
        source: 'default-calendar'
      };
    },
    createMockData: function createMockData() {
      return {
        dateLabel: 'Today',
        appointments: [
          { time: '09:00', title: 'Stand-up', location: 'Teams' },
          { time: '10:30', title: 'Deep work block', location: 'Home office' },
          { time: '13:00', title: 'Client review', location: 'WeWork Meeting Room' },
          { time: '19:00', title: 'Dinner reservation', location: 'Le Petit Marchand' }
        ]
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
      return {
        source: 'default-task-list'
      };
    },
    createMockData: function createMockData() {
      return {
        groups: [
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
