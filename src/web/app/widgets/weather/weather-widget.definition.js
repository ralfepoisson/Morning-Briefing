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
        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'weather',
          title: options.title || 'Weather Outlook',
          x: options.x,
          y: options.y,
          width: 320,
          height: 360,
          data: {
            location: options.location || 'Mocked forecast',
            temperature: options.temperature || '18°',
            condition: options.condition || 'Partly sunny',
            highLow: options.highLow || 'H: 20°  L: 11°',
            summary: options.summary || 'Mock data for the MVP. This widget will later hydrate from a briefing snapshot.',
            details: options.details || [
              { label: 'Feels like', value: '17°' },
              { label: 'Rain', value: '10%' },
              { label: 'UV', value: 'Moderate' }
            ]
          }
        };
      }
    });
  }
})();
