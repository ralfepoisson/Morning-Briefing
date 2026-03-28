(function () {
  'use strict';

  angular.module('morningBriefingApp').run(registerNatgeoDailyPhotoWidget);

  registerNatgeoDailyPhotoWidget.$inject = ['WidgetRegistryService'];

  function registerNatgeoDailyPhotoWidget(WidgetRegistryService) {
    WidgetRegistryService.register({
      type: 'natgeo-daily-photo',
      name: 'NatGeo Daily Photo',
      label: 'NatGeo Daily Photo widget',
      iconClass: 'fa-solid fa-camera',
      description: 'National Geographic Photo of the Day with its lead caption sentence',
      elementName: 'natgeo-daily-photo-widget',
      cardClass: 'widget-card--natgeo',
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
          type: 'natgeo-daily-photo',
          isLoading: !!options.isLoading,
          title: options.title || 'NatGeo Daily Photo',
          x: options.x,
          y: options.y,
          width: options.width || 420,
          height: options.height || 420,
          config: options.config || {},
          data: {
            title: data.title || 'NatGeo Daily Photo',
            description: data.description || 'The latest National Geographic Photo of the Day will appear here after the snapshot refresh completes.',
            imageUrl: data.imageUrl || '',
            altText: data.altText || 'National Geographic Photo of the Day placeholder',
            permalink: data.permalink || 'https://www.nationalgeographic.com/photo-of-the-day/',
            credit: data.credit || '',
            emptyMessage: data.emptyMessage || 'The latest National Geographic Photo of the Day will load automatically after the snapshot refresh completes.'
          }
        };
      }
    });
  }
})();
