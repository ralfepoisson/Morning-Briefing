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
        var connectionLabel = data.connectionLabel || options.connectionLabel || (options.config && options.config.connectionName) || '';
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
            emptyMessage: data.emptyMessage || (!connectionLabel
              ? 'Choose a Gmail connection in edit mode to configure this widget.'
              : 'Email messages are still loading or unavailable. Refresh after the snapshot completes.'),
            messages: data.messages || options.messages || []
          }
        };
      }
    });
  }
})();
