(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerWeatherWidget);

  registerWeatherWidget.$inject = ['WidgetRegistryService'];

  function registerWeatherWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'weather',
      name: 'Weather',
      label: 'Weather widget',
      iconClass: 'fa-solid fa-sun',
      description: 'Mocked daily forecast',
      elementName: 'weather-widget',
      cardClass: 'widget-card--weather',
      defaultSize: {
        width: 320,
        height: 360
      },
      resizable: {
        vertical: false
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};
        var config = options.config || {};
        var configuredLocation = getConfiguredLocation(config);

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'weather',
          title: options.title || 'Weather Outlook',
          x: options.x,
          y: options.y,
          width: options.width || 320,
          height: options.height || 360,
          config: config,
          data: {
            location: data.location || options.location || configuredLocation || 'Select a city',
            temperature: data.temperature || options.temperature || '18°',
            condition: data.condition || options.condition || 'Partly sunny',
            highLow: data.highLow || options.highLow || 'H: 20°  L: 11°',
            summary: data.summary || options.summary || (configuredLocation
              ? 'Mock data for the MVP. This widget will later hydrate from a briefing snapshot.'
              : 'Choose a city in edit mode to configure this widget.'),
            details: data.details || options.details || (configuredLocation
              ? [
                  { label: 'Feels like', value: '17°' },
                  { label: 'Rain', value: '10%' },
                  { label: 'UV', value: 'Moderate' }
                ]
              : [])
          }
        };
      }
    });
  }

  function getConfiguredLocation(config) {
    if (typeof config.location === 'string' && config.location.trim()) {
      return config.location;
    }

    if (!config.location || typeof config.location !== 'object') {
      return '';
    }

    if (typeof config.location.displayName === 'string' && config.location.displayName.trim()) {
      return config.location.displayName;
    }

    if (typeof config.location.name === 'string' && config.location.name.trim()) {
      if (typeof config.location.countryCode === 'string' && config.location.countryCode.trim()) {
        return config.location.name + ', ' + config.location.countryCode;
      }

      return config.location.name;
    }

    return '';
  }
})();
