(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerEmailWidget);

  registerEmailWidget.$inject = ['WidgetRegistryService'];

  function registerEmailWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'email',
      name: 'Email',
      label: 'Email',
      iconClass: 'fa-regular fa-envelope',
      description: 'Messages from your mail filters',
      elementName: 'email-widget',
      cardClass: 'widget-card--email',
      defaultSize: {
        width: 420,
        height: 360
      },
      resizable: {
        minWidth: 160,
        minHeight: 140
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};
        var connectionLabel = data.connectionLabel || options.connectionLabel || (options.config && options.config.connectionName) || 'Not connected';
        var filters = data.filters || (options.config && options.config.filters) || ['in:inbox'];

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'email',
          isLoading: !!options.isLoading,
          title: options.title || 'Email',
          x: options.x,
          y: options.y,
          width: options.width || 420,
          height: options.height || 360,
          config: options.config || {},
          data: {
            provider: data.provider || 'gmail',
            connectionLabel: connectionLabel,
            filters: filters,
            emptyMessage: data.emptyMessage || (connectionLabel === 'Not connected'
              ? 'Choose a Gmail connection in edit mode to configure this widget.'
              : 'Live messages will appear after you save the dashboard.'),
            messages: data.messages || options.messages || (connectionLabel === 'Not connected' ? [] : [
              {
                id: 'email-1',
                subject: 'Project kickoff agenda',
                from: 'Alex Morgan <alex@example.com>',
                receivedAt: '2026-03-26T07:45:00.000Z',
                isUnread: true
              },
              {
                id: 'email-2',
                subject: 'Travel confirmation for next week',
                from: 'Airline Updates <updates@example.com>',
                receivedAt: '2026-03-26T06:10:00.000Z',
                isUnread: false
              },
              {
                id: 'email-3',
                subject: 'Design review notes',
                from: 'Priya Shah <priya@example.com>',
                receivedAt: '2026-03-25T20:20:00.000Z',
                isUnread: true
              }
            ])
          }
        };
      }
    });
  }
})();
