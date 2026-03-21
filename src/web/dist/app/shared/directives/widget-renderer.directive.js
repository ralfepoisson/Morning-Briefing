(function () {
  'use strict';

  angular.module('morningBriefingApp').directive('widgetRenderer', widgetRenderer);

  widgetRenderer.$inject = ['$compile', 'WidgetRegistryService'];

  function widgetRenderer($compile, WidgetRegistryService) {
    return {
      restrict: 'A',
      scope: {
        widget: '<'
      },
      link: function link(scope, element) {
        scope.$watch('widget', render, true);

        function render(widget) {
          var definition;
          var childScope;

          element.empty();

          if (!widget) {
            return;
          }

          definition = WidgetRegistryService.get(widget.type);

          if (widget.isLoading) {
            element.append($compile(
              '<div class="widget-loading-state">' +
              '  <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>' +
              '  <span>Loading snapshot...</span>' +
              '</div>'
            )(scope.$new()));
            return;
          }

          if (!definition || !definition.elementName) {
            return;
          }

          childScope = scope.$new();
          childScope.widget = widget;
          element.append($compile('<' + definition.elementName + ' widget="widget"></' + definition.elementName + '>')(childScope));
        }
      }
    };
  }
})();
