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
        vertical: true,
        minHeight: 260,
        maxHeight: 560
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'tasks',
          title: options.title || 'Task List',
          x: options.x,
          y: options.y,
          width: options.width || 360,
          height: options.height || 360,
          config: options.config || {},
          data: {
            groups: data.groups || options.groups || [
              {
                label: 'Due Today',
                items: [
                  { title: 'Reply to insurance email' },
                  { title: 'Confirm dinner reservation' }
                ]
              },
              {
                label: 'Due Tomorrow',
                items: [
                  { title: 'Draft project update' },
                  { title: 'Buy birthday card' }
                ]
              },
              {
                label: 'No Due Date',
                items: [
                  { title: 'Declutter camera roll' },
                  { title: 'Research standing desk options' }
                ]
              }
            ]
          }
        };
      }
    });
  }
})();
