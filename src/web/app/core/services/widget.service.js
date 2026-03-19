(function () {
  'use strict';

  angular.module('morningBriefingApp').service('WidgetService', WidgetService);

  function WidgetService() {
    var nextWidgetId = 3;
    var widgetsByDashboard = {
      1: [
        {
          id: 1,
          dashboardId: 1,
          type: 'weather',
          title: 'Paris Weather',
          x: 24,
          y: 24,
          width: 320,
          height: 360,
          data: {
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
          }
        },
        {
          id: 2,
          dashboardId: 1,
          type: 'calendar',
          title: 'Today on Calendar',
          x: 372,
          y: 24,
          width: 360,
          height: 360,
          data: {
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
          }
        }
      ]
    };

    this.listForDashboard = function listForDashboard(dashboardId) {
      widgetsByDashboard[dashboardId] = widgetsByDashboard[dashboardId] || [];
      return widgetsByDashboard[dashboardId];
    };

    this.addWeatherWidget = function addWeatherWidget(dashboardId) {
      var currentWidgets = this.listForDashboard(dashboardId);
      var widget = {
        id: nextWidgetId++,
        dashboardId: dashboardId,
        type: 'weather',
        title: 'Weather Outlook',
        x: 36 + currentWidgets.length * 28,
        y: 36 + currentWidgets.length * 28,
        width: 320,
        height: 360,
        data: {
          location: 'Mocked forecast',
          temperature: '18°',
          condition: 'Partly sunny',
          highLow: 'H: 20°  L: 11°',
          summary: 'Mock data for the MVP. This widget will later hydrate from a briefing snapshot.',
          details: [
            { label: 'Feels like', value: '17°' },
            { label: 'Rain', value: '10%' },
            { label: 'UV', value: 'Moderate' }
          ]
        }
      };

      currentWidgets.push(widget);
      return widget;
    };

    this.addCalendarWidget = function addCalendarWidget(dashboardId) {
      var currentWidgets = this.listForDashboard(dashboardId);
      var widget = {
        id: nextWidgetId++,
        dashboardId: dashboardId,
        type: 'calendar',
        title: 'Today on Calendar',
        x: 36 + currentWidgets.length * 28,
        y: 36 + currentWidgets.length * 28,
        width: 360,
        height: 360,
        data: {
          dateLabel: 'Today',
          appointments: [
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
      widget.height = Math.max(widget.type === 'calendar' ? 260 : widget.height, Math.round(height));
    };
  }
})();
