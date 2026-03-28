(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerTasksWidget);

  registerTasksWidget.$inject = ['WidgetRegistryService'];

  function registerTasksWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'tasks',
      name: 'Task list',
      label: 'Tasks widget',
      iconClass: 'fa-solid fa-list-check',
      description: 'Today, tomorrow, and undated tasks',
      elementName: 'tasks-widget',
      cardClass: 'widget-card--tasks',
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
        var connectionLabel = data.connectionLabel || options.connectionLabel || (config && config.connectionName) || '';

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'tasks',
          isLoading: !!options.isLoading,
          title: options.title || 'Task List',
          x: options.x,
          y: options.y,
          width: options.width || 360,
          height: options.height || 360,
          config: config,
          data: {
            provider: data.provider || 'todoist',
            connectionLabel: connectionLabel,
            emptyMessage: data.emptyMessage || (!connectionLabel
              ? 'Choose a connection in edit mode to configure this widget.'
              : 'Tasks are still loading or unavailable. Refresh after the snapshot completes.'),
            groups: data.groups || options.groups || []
          }
        };
      }
    });
  }
})();
