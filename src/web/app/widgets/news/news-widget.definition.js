(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerNewsWidget);

  registerNewsWidget.$inject = ['WidgetRegistryService'];

  function registerNewsWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'news',
      name: 'News',
      label: 'News widget',
      iconClass: 'fa-regular fa-newspaper',
      description: 'Summaries from configured RSS feeds',
      elementName: 'news-widget',
      cardClass: 'widget-card--news',
      defaultSize: {
        width: 420,
        height: 420
      },
      resizable: {
        minWidth: 140,
        minHeight: 140
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'news',
          isLoading: !!options.isLoading,
          title: options.title || 'News Briefing',
          x: options.x,
          y: options.y,
          width: options.width || 420,
          height: options.height || 420,
          config: options.config || {},
          data: {
            headline: data.headline || '',
            markdown: data.markdown || '',
            categories: data.categories || [],
            emptyMessage: data.emptyMessage || 'News is still loading or unavailable. Add RSS feeds or refresh after the snapshot completes.'
          }
        };
      }
    });
  }
})();
