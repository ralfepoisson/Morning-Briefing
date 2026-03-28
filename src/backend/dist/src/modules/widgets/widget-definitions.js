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
        type: 'natgeo-daily-photo',
        name: 'NatGeo Daily Photo',
        title: 'NatGeo Daily Photo',
        description: 'National Geographic Photo of the Day with its lead caption sentence',
        briefingDefaultIncluded: false,
        defaultSize: { width: 420, height: 420 },
        minSize: { width: 360, height: 320 },
        refreshMode: 'SNAPSHOT',
        createDefaultConfig: function createDefaultConfig() {
            return {};
        },
        createMockData: function createMockData() {
            return {
                title: 'NatGeo Daily Photo',
                description: 'The latest National Geographic Photo of the Day will appear here after the snapshot refresh completes.',
                imageUrl: '',
                altText: 'National Geographic Photo of the Day placeholder',
                permalink: 'https://www.nationalgeographic.com/photo-of-the-day/',
                credit: '',
                emptyMessage: 'The latest National Geographic Photo of the Day will load automatically after the snapshot refresh completes.'
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
        description: 'Daily forecast from the configured weather source',
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
                location: location || '',
                temperature: '',
                condition: '',
                highLow: '',
                summary: location
                    ? 'Weather data is still loading or unavailable. Refresh after the snapshot completes.'
                    : 'Choose a city in edit mode to configure this widget.',
                details: []
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
                connectionLabel,
                dateLabel: 'Today',
                emptyMessage: connectionLabel
                    ? 'Calendar events are still loading or unavailable. Refresh after the snapshot completes.'
                    : 'Choose a Google Calendar connection in edit mode to configure this widget.',
                appointments: []
            };
        }
    },
    {
        type: 'email',
        name: 'Email',
        title: 'Email',
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
                connectionLabel,
                filters,
                emptyMessage: connectionLabel
                    ? 'Email messages are still loading or unavailable. Refresh after the snapshot completes.'
                    : 'Choose a Gmail connection in edit mode to configure this widget.',
                messages: []
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
            return {
                provider: 'todoist',
                connectionLabel,
                emptyMessage: connectionLabel
                    ? 'Tasks are still loading or unavailable. Refresh after the snapshot completes.'
                    : 'Choose a Todoist connection in edit mode to configure this widget.',
                groups: []
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
