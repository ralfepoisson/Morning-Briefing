(function () {
  'use strict';

  angular.module('morningBriefingApp').service('WidgetService', WidgetService);

  function WidgetService() {
    var nextWidgetId = 2;
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
  }
})();
