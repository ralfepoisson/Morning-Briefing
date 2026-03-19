(function () {
  'use strict';

  angular.module('morningBriefingApp').service('WidgetService', WidgetService);

  WidgetService.$inject = ['WidgetRegistryService'];

  function WidgetService(WidgetRegistryService) {
    var nextWidgetId = 4;
    var widgetsByDashboard = {
      1: [
        createSeedWidget('weather', 1, 24, 24, {
          title: 'Paris Weather',
          location: 'Paris, France',
          temperature: '14°',
          condition: 'Clear and bright',
          highLow: 'H: 17°  L: 9°',
          summary: 'Dry through the afternoon with soft sunshine and a light breeze.',
          details: [
            { label: 'Sunrise', value: '06:58' },
            { label: 'Humidity', value: '61%' },
            { label: 'Wind', value: '12 km/h' }
          ]
        }),
        createSeedWidget('calendar', 1, 372, 24, {
          title: 'Today on Calendar',
          dateLabel: 'Today',
          appointments: [
            {
              time: '08:30',
              title: 'Product sync',
              location: 'Zoom Room A'
            },
            {
              time: '11:00',
              title: 'Lunch with Marie',
              location: 'Cafe de la Paix'
            },
            {
              time: '15:30',
              title: 'Dentist appointment',
              location: 'Rue de Rennes Clinic'
            },
            {
              time: '18:15',
              title: 'Gym session',
              location: 'Neighborhood fitness club'
            }
          ]
        }),
        createSeedWidget('tasks', 1, 756, 24, {
          title: 'Task List',
          groups: [
            {
              label: 'Due Today',
              items: [
                { title: 'Send expense report' },
                { title: 'Book train tickets for Lyon' }
              ]
            },
            {
              label: 'Due Tomorrow',
              items: [
                { title: 'Prepare sprint demo notes' },
                { title: 'Pick up dry cleaning' }
              ]
            },
            {
              label: 'No Due Date',
              items: [
                { title: 'Review summer travel options' },
                { title: 'Organize desk drawer' }
              ]
            }
          ]
        })
      ]
    };

    this.listForDashboard = function listForDashboard(dashboardId) {
      widgetsByDashboard[dashboardId] = widgetsByDashboard[dashboardId] || [];
      return widgetsByDashboard[dashboardId];
    };

    this.addWidget = function addWidget(dashboardId, type) {
      var currentWidgets = this.listForDashboard(dashboardId);
      var definition = WidgetRegistryService.get(type);
      var widget;

      if (!definition || typeof definition.createMockWidget !== 'function') {
        return null;
      }

      widget = definition.createMockWidget({
        id: nextWidgetId++,
        dashboardId: dashboardId,
        x: 36 + currentWidgets.length * 28,
        y: 36 + currentWidgets.length * 28
      });

      currentWidgets.push(widget);
      return widget;
    };

    this.updatePosition = function updatePosition(dashboardId, widgetId, x, y) {
      var widget = this.listForDashboard(dashboardId).find(function (item) {
        return item.id === widgetId;
      });

      if (!widget) {
        return;
      }

      widget.x = Math.max(0, Math.round(x));
      widget.y = Math.max(0, Math.round(y));
    };

    this.updateSize = function updateSize(dashboardId, widgetId, width, height) {
      var widget = this.listForDashboard(dashboardId).find(function (item) {
        return item.id === widgetId;
      });

      if (!widget) {
        return;
      }

      widget.width = Math.round(width);
      widget.height = Math.max(getMinHeight(widget.type, widget.height), Math.round(height));
    };

    function createSeedWidget(type, dashboardId, x, y, overrides) {
      var definition = WidgetRegistryService.get(type);

      return definition.createMockWidget(angular.extend({}, overrides, {
        id: nextWidgetId - 3 + (type === 'weather' ? 0 : type === 'calendar' ? 1 : 2),
        dashboardId: dashboardId,
        x: x,
        y: y
      }));
    }

    function getMinHeight(type, fallbackHeight) {
      var definition = WidgetRegistryService.get(type);

      if (definition && definition.resizable && definition.resizable.vertical) {
        return definition.resizable.minHeight;
      }

      return fallbackHeight;
    };
  }
})();
