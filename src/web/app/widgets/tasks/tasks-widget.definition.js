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
        var connectionLabel = data.connectionLabel || options.connectionLabel || (options.config && options.config.connectionName) || 'Not connected';

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
          config: options.config || {},
          data: {
            provider: data.provider || 'todoist',
            connectionLabel: connectionLabel,
            emptyMessage: data.emptyMessage || (connectionLabel === 'Not connected'
              ? 'Choose a connection in edit mode to configure this widget.'
              : 'Live tasks will appear after you save the dashboard.'),
            groups: data.groups || options.groups || (connectionLabel === 'Not connected' ? [] : [
              {
                label: 'Due Today',
                items: [
                  { title: 'Reply to insurance email', meta: 'today' },
                  { title: 'Confirm dinner reservation', meta: 'today' }
                ]
              },
              {
                label: 'Due Tomorrow',
                items: [
                  { title: 'Draft project update', meta: 'tomorrow' },
                  { title: 'Buy birthday card', meta: 'tomorrow' }
                ]
              },
              {
                label: 'No Due Date',
                items: [
                  { title: 'Declutter camera roll', meta: '' },
                  { title: 'Research standing desk options', meta: '' }
                ]
              }
            ])
          }
        };
      }
    });
  }
})();
