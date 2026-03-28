(function () {
  'use strict';

  angular.module('morningBriefingApp').directive('mbFileChange', function mbFileChangeDirective() {
    return {
      restrict: 'A',
      scope: {
        mbFileChange: '&'
      },
      link: function link(scope, element) {
        element.on('change', function handleChange(event) {
          scope.$applyAsync(function notifyFileChange() {
            scope.mbFileChange({
              $event: event
            });
          });
        });

        scope.$on('$destroy', function cleanup() {
          element.off('change');
        });
      }
    };
  });
})();
