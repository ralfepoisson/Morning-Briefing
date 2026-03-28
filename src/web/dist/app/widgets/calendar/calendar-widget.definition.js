(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerCalendarWidget);

  registerCalendarWidget.$inject = ['WidgetRegistryService'];

  function registerCalendarWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'calendar',
      name: 'Calendar',
      label: 'Calendar widget',
      iconClass: 'fa-regular fa-calendar',
      description: 'Today\'s appointments',
      elementName: 'calendar-widget',
      cardClass: 'widget-card--calendar',
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
        var connectionLabel = data.connectionLabel || options.connectionLabel || (options.config && options.config.connectionName) || '';

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'calendar',
          isLoading: !!options.isLoading,
          title: options.title || 'Today on Calendar',
          x: options.x,
          y: options.y,
          width: options.width || 360,
          height: options.height || 360,
          config: options.config || {},
          data: {
            provider: data.provider || 'google-calendar',
            connectionLabel: connectionLabel,
            dateLabel: data.dateLabel || options.dateLabel || 'Today',
            emptyMessage: data.emptyMessage || (!connectionLabel
              ? 'Choose a Google Calendar connection in edit mode to configure this widget.'
              : 'Calendar events are still loading or unavailable. Refresh after the snapshot completes.'),
            appointments: data.appointments || options.appointments || []
          }
        };
      }
    });
  }
})();
