(function () {
  'use strict';

  angular.module('morningBriefingApp').service('WidgetService', WidgetService);

  WidgetService.$inject = ['WidgetRegistryService', '$http', '$q', 'ApiConfig'];

  function WidgetService(WidgetRegistryService, $http, $q, ApiConfig) {
    var widgetsByDashboard = {};
    var loadingPromises = {};

    this.listForDashboard = function listForDashboard(dashboardId) {
      widgetsByDashboard[dashboardId] = widgetsByDashboard[dashboardId] || [];
      return widgetsByDashboard[dashboardId];
    };

    this.loadForDashboard = function loadForDashboard(dashboardId) {
      if (!dashboardId) {
        return $q.resolve([]);
      }

      if (loadingPromises[dashboardId]) {
        return loadingPromises[dashboardId];
      }

      loadingPromises[dashboardId] = $http.get(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/widgets').then(function handleResponse(response) {
        replaceWidgets(dashboardId, response.data.items || []);
        return widgetsByDashboard[dashboardId];
      }).finally(function clearPromise() {
        loadingPromises[dashboardId] = null;
      });

      return loadingPromises[dashboardId];
    };

    this.addWidget = function addWidget(dashboardId, type) {
      return $http.post(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/widgets', {
        type: type
      }).then(function handleResponse(response) {
        var widget = hydrateWidget(response.data);
        var currentWidgets = this.listForDashboard(dashboardId);

        currentWidgets.push(widget);
        return widget;
      }.bind(this));
    };

    this.saveDashboardWidgets = function saveDashboardWidgets(dashboardId) {
      return $q.all(this.listForDashboard(dashboardId).map(function saveWidget(widget) {
        return $http.patch(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/widgets/' + widget.id, {
          x: widget.x,
          y: widget.y,
          width: widget.width,
          height: widget.height,
          config: widget.config || {}
        }).then(function handleResponse(response) {
          widget.x = response.data.x;
          widget.y = response.data.y;
          widget.width = response.data.width;
          widget.height = response.data.height;
          widget.config = response.data.config || widget.config || {};
          widget.data = response.data.data || widget.data;
          return widget;
        });
      }));
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

      widget.width = Math.max(getMinWidth(widget.type), Math.round(width));
      widget.height = Math.max(getMinHeight(widget.type), Math.round(height));
    };

    this.applySnapshot = function applySnapshot(dashboardId, snapshot) {
      this.listForDashboard(dashboardId).forEach(function applyWidgetSnapshot(widget) {
        var snapshotWidget = snapshot && snapshot.widgets
          ? snapshot.widgets.find(function findSnapshotWidget(item) {
          return item.widgetId === widget.id;
          })
          : null;

        widget.isLoading = false;

        if (!snapshotWidget || !snapshotWidget.content) {
          return;
        }

        widget.data = snapshotWidget.content;

        if (widget.type === 'weather') {
          widget.title = 'Weather Outlook';
        }

        if (widget.type === 'news') {
          widget.title = 'News Briefing';
        }

        if (widget.type === 'tasks') {
          widget.title = 'Task List';
        }

        if (widget.type === 'calendar') {
          widget.title = 'Today on Calendar';
        }
      });

      return this.listForDashboard(dashboardId);
    };

    function hydrateWidget(widgetPayload) {
      var definition = WidgetRegistryService.get(widgetPayload.type);

      if (!definition || typeof definition.createMockWidget !== 'function') {
        return widgetPayload;
      }

      return definition.createMockWidget({
        id: widgetPayload.id,
        dashboardId: widgetPayload.dashboardId,
        title: widgetPayload.title,
        x: widgetPayload.x,
        y: widgetPayload.y,
        width: widgetPayload.width,
        height: widgetPayload.height,
        minWidth: widgetPayload.minWidth,
        minHeight: widgetPayload.minHeight,
        config: widgetPayload.config || {},
        data: widgetPayload.data,
        location: widgetPayload.data && widgetPayload.data.location,
        temperature: widgetPayload.data && widgetPayload.data.temperature,
        condition: widgetPayload.data && widgetPayload.data.condition,
        highLow: widgetPayload.data && widgetPayload.data.highLow,
        summary: widgetPayload.data && widgetPayload.data.summary,
        headline: widgetPayload.data && widgetPayload.data.headline,
        markdown: widgetPayload.data && widgetPayload.data.markdown,
        categories: widgetPayload.data && widgetPayload.data.categories,
        details: widgetPayload.data && widgetPayload.data.details,
        dateLabel: widgetPayload.data && widgetPayload.data.dateLabel,
        appointments: widgetPayload.data && widgetPayload.data.appointments,
        groups: widgetPayload.data && widgetPayload.data.groups,
        isLoading: widgetPayload.isLoading !== undefined ? widgetPayload.isLoading : true
      });
    }

    function getMinWidth(type) {
      var definition = WidgetRegistryService.get(type);

      if (definition && definition.resizable && definition.resizable.minWidth) {
        return definition.resizable.minWidth;
      }

      return 140;
    }

    function getMinHeight(type) {
      var definition = WidgetRegistryService.get(type);

      if (definition && definition.resizable && definition.resizable.minHeight) {
        return definition.resizable.minHeight;
      }

      return 140;
    }

    function replaceWidgets(dashboardId, nextWidgets) {
      var currentWidgets = widgetsByDashboard[dashboardId] = [];

      nextWidgets.forEach(function (widgetPayload) {
        widgetPayload.isLoading = true;
        currentWidgets.push(hydrateWidget(widgetPayload));
      });
    }
  }
})();
