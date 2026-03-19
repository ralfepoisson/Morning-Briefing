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
        vertical: true,
        minHeight: 260,
        maxHeight: 560
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'calendar',
          title: options.title || 'Today on Calendar',
          x: options.x,
          y: options.y,
          width: options.width || 360,
          height: options.height || 360,
          config: options.config || {},
          data: {
            dateLabel: data.dateLabel || options.dateLabel || 'Today',
            appointments: data.appointments || options.appointments || [
              {
                time: '09:00',
                title: 'Stand-up',
                location: 'Teams'
              },
              {
                time: '10:30',
                title: 'Deep work block',
                location: 'Home office'
              },
              {
                time: '13:00',
                title: 'Client review',
                location: 'WeWork Meeting Room'
              },
              {
                time: '19:00',
                title: 'Dinner reservation',
                location: 'Le Petit Marchand'
              }
            ]
          }
        };
      }
    });
  }
})();
