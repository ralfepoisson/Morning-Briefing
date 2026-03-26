const widgetDefinitions = [
    {
        type: 'xkcd',
        name: 'xkcd',
        title: 'Latest xkcd',
        description: 'The newest comic from xkcd.com',
        briefingDefaultIncluded: false,
        defaultSize: { width: 420, height: 420 },
        minSize: { width: 360, height: 320 },
        refreshMode: 'SNAPSHOT',
        createDefaultConfig: function createDefaultConfig() {
            return {};
        },
        createMockData: function createMockData() {
            return {
                comicId: 0,
                title: 'Latest xkcd',
                altText: 'The latest xkcd comic will appear here after the snapshot refresh completes.',
                imageUrl: '',
                permalink: 'https://xkcd.com/',
                publishedAt: '',
                emptyMessage: 'The latest xkcd comic will load automatically after the snapshot refresh completes.'
            };
        }
    },
    {
        type: 'news',
        name: 'News',
        title: 'News Briefing',
        description: 'Summaries from configured RSS feeds',
        briefingDefaultIncluded: true,
        defaultSize: { width: 420, height: 420 },
        minSize: { width: 360, height: 320 },
        refreshMode: 'SNAPSHOT',
        createDefaultConfig: function createDefaultConfig() {
            return {};
        },
        createMockData: function createMockData() {
            return {
                headline: 'Top stories from your RSS feeds.',
                markdown: '# Top stories from your RSS feeds.\n\n## Getting started\n- Add feeds on the RSS Feeds page to generate a news snapshot.',
                categories: [],
                emptyMessage: 'Add RSS feeds on the RSS Feeds page to start generating news summaries.'
            };
        }
    },
    {
        type: 'weather',
        name: 'Weather',
        title: 'Weather Outlook',
        description: 'Mocked daily forecast',
        briefingDefaultIncluded: true,
        defaultSize: { width: 360, height: 360 },
        minSize: { width: 360, height: 360 },
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
        briefingDefaultIncluded: true,
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
        type: 'email',
        name: 'Email',
        title: 'Recent Email',
        description: 'Messages from your mail filters',
        briefingDefaultIncluded: true,
        defaultSize: { width: 420, height: 360 },
        minSize: { width: 360, height: 260 },
        refreshMode: 'SNAPSHOT',
        createDefaultConfig: function createDefaultConfig() {
            return {
                filters: ['in:inbox']
            };
        },
        createMockData: function createMockData(config) {
            const connectionLabel = getEmailConnectionLabel(config);
            const filters = getEmailFilters(config);
            return {
                provider: 'gmail',
                connectionLabel: connectionLabel || 'Not connected',
                filters,
                emptyMessage: connectionLabel
                    ? 'Live messages will appear after you save the dashboard.'
                    : 'Choose a Gmail connection in edit mode to configure this widget.',
                messages: connectionLabel
                    ? [
                        {
                            id: 'email-1',
                            subject: 'Project kickoff agenda',
                            from: 'Alex Morgan <alex@example.com>',
                            receivedAt: '2026-03-26T07:45:00.000Z',
                            isUnread: true
                        },
                        {
                            id: 'email-2',
                            subject: 'Travel confirmation for next week',
                            from: 'Airline Updates <updates@example.com>',
                            receivedAt: '2026-03-26T06:10:00.000Z',
                            isUnread: false
                        },
                        {
                            id: 'email-3',
                            subject: 'Design review notes',
                            from: 'Priya Shah <priya@example.com>',
                            receivedAt: '2026-03-25T20:20:00.000Z',
                            isUnread: true
                        }
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
        briefingDefaultIncluded: true,
        defaultSize: { width: 360, height: 360 },
        minSize: { width: 360, height: 260 },
        refreshMode: 'SNAPSHOT',
        createDefaultConfig: function createDefaultConfig() {
            return {
                showUndatedTasks: true
            };
        },
        createMockData: function createMockData(config) {
            const connectionLabel = getTaskConnectionLabel(config);
            const groups = [
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
                }
            ];
            if (shouldShowUndatedTasks(config)) {
                groups.push({
                    label: 'No Due Date',
                    items: [
                        { title: 'Declutter camera roll' },
                        { title: 'Research standing desk options' }
                    ]
                });
            }
            return {
                provider: 'todoist',
                connectionLabel: connectionLabel || 'Not connected',
                emptyMessage: connectionLabel
                    ? 'Live tasks will appear after you save the dashboard.'
                    : 'Choose a Todoist connection in edit mode to configure this widget.',
                groups: connectionLabel ? groups : []
            };
        }
    }
];
export function listWidgetDefinitions() {
    return widgetDefinitions.slice();
}
export function getWidgetDefinition(type) {
    return widgetDefinitions.find(function (definition) {
        return definition.type === type;
    }) || null;
}
function getWeatherLocationLabel(config) {
    if (typeof config.location === 'string' && config.location.trim()) {
        return config.location;
    }
    if (!config.location || typeof config.location !== 'object') {
        return '';
    }
    const location = config.location;
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
function getTaskConnectionLabel(config) {
    if (typeof config.connectionName === 'string' && config.connectionName.trim()) {
        return config.connectionName;
    }
    return '';
}
function shouldShowUndatedTasks(config) {
    return config.showUndatedTasks !== false;
}
function getCalendarConnectionLabel(config) {
    if (typeof config.connectionName === 'string' && config.connectionName.trim()) {
        return config.connectionName;
    }
    return '';
}
function getEmailConnectionLabel(config) {
    if (typeof config.connectionName === 'string' && config.connectionName.trim()) {
        return config.connectionName;
    }
    return '';
}
function getEmailFilters(config) {
    if (!Array.isArray(config.filters)) {
        return ['in:inbox'];
    }
    const filters = config.filters.filter(function filterValue(value) {
        return typeof value === 'string' && value.trim();
    }).map(function mapValue(value) {
        return value.trim();
    });
    return filters.length ? filters : ['in:inbox'];
}
