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
        width: 360,
        height: 360
      },
      resizable: {
        minWidth: 140,
        minHeight: 140
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};
        var config = options.config || {};
        var configuredLocation = getConfiguredLocation(config);

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'weather',
          isLoading: !!options.isLoading,
          title: options.title || 'Weather Outlook',
          x: options.x,
          y: options.y,
          width: options.width || 360,
          height: options.height || 360,
          config: config,
          data: {
            location: data.location || options.location || configuredLocation || '',
            temperature: data.temperature || options.temperature || '',
            condition: data.condition || options.condition || '',
            highLow: data.highLow || options.highLow || '',
            summary: data.summary || options.summary || (configuredLocation
              ? 'Weather data is still loading or unavailable. Refresh after the snapshot completes.'
              : 'Choose a city in edit mode to configure this widget.'),
            details: data.details || options.details || []
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
