(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerXkcdWidget);

  registerXkcdWidget.$inject = ['WidgetRegistryService'];

  function registerXkcdWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'xkcd',
      name: 'xkcd',
      label: 'xkcd widget',
      iconClass: 'fa-regular fa-image',
      description: 'The newest comic from xkcd.com',
      elementName: 'xkcd-widget',
      cardClass: 'widget-card--xkcd',
      defaultSize: {
        width: 420,
        height: 420
      },
      resizable: {
        minWidth: 180,
        minHeight: 180
      },
      createMockWidget: function createMockWidget(options) {
        var data = options.data || {};

        return {
          id: options.id,
          dashboardId: options.dashboardId,
          type: 'xkcd',
          isLoading: !!options.isLoading,
          title: options.title || 'Latest xkcd',
          x: options.x,
          y: options.y,
          width: options.width || 420,
          height: options.height || 420,
          config: options.config || {},
          data: {
            comicId: data.comicId || 0,
            title: data.title || 'Latest xkcd',
            altText: data.altText || 'The latest xkcd comic will appear here after the snapshot refresh completes.',
            imageUrl: data.imageUrl || '',
            permalink: data.permalink || 'https://xkcd.com/',
            publishedAt: data.publishedAt || '',
            emptyMessage: data.emptyMessage || 'The latest xkcd comic will load automatically after the snapshot refresh completes.'
          }
        };
      }
    });
  }
})();
